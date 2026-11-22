import { checkDailyGenerationLimit } from "../../../../lib/server/generation-jobs";

import { createHash } from "node:crypto";

export const maxDuration = 120;

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", {
    headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store"
  });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string }, token, url, anon };
}

async function recordJob(url: string, token: string, anon: string, ownerId: string, prompt: string, provider: string, model: string, resolution: string) {
  try {
    await fetch(url + "/rest/v1/generation_jobs", {
      method: "POST",
      headers: { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ owner_id: ownerId, service_type: "image", prompt, status: "completed", result: { provider, model, resolution } }),
      cache: "no-store"
    });
  } catch { /* Return the image even if optional history logging is unavailable. */ }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return Response.json({ error: "سجّل الدخول أولاً لإنشاء الصور." }, { status: 401 });
    const body = await request.json() as { prompt?: string; resolution?: string; provider?: string };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 12000) return Response.json({ error: "اكتب وصفاً للصورة لا يتجاوز 12000 حرف." }, { status: 400 });
    const resolution = ["1080p", "2K", "4K"].includes(body.resolution || "") ? body.resolution! : "2K";
    const provider = (["google", "openai", "stability", "fal"].includes(body.provider || "") ? body.provider : "openai") as "google" | "openai" | "stability" | "fal";
    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id, serviceType: "image" });
    if (!usage.allowed) return Response.json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, { status: usage.reason === "limit" ? 429 : 503 });
    if (resolution === "4K" && (provider === "stability" || provider === "fal")) return Response.json({ error: "هذا المحرك لا يضمن 4K. اختر Gemini أو OpenAI لاستهداف 4K." }, { status: 400 });
    if (resolution === "4K" && usage.plan !== "pro") return Response.json({ error: "دقة 4K متاحة لخطة Pro. يمكنك استخدام 2K ضمن خطتك الحالية." }, { status: 403 });

    let image = "";
    let mimeType = "image/png";
    let model = "";

    if (provider === "google") {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) return Response.json({ error: "Gemini Image غير مربوط. أضف GOOGLE_AI_API_KEY في إعدادات الخادم." }, { status: 503 });
      model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
      const imageSize = resolution === "1080p" ? "1K" : resolution;
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: prompt,
          response_format: { type: "image", aspect_ratio: "16:9", image_size: imageSize }
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(110000)
      });
      const data = await response.json();
      const outputImage = data.output_image || (data.steps || []).flatMap((step: any) => step.content || []).find((part: any) => part.type === "image");
      if (!response.ok || !outputImage?.data) return Response.json({ error: "تعذر إنشاء الصورة عبر Gemini. تحقق من المفتاح والنموذج." }, { status: 502 });
      image = outputImage.data;
      mimeType = outputImage.mime_type || "image/png";
    } else if (provider === "fal") {
      const key = process.env.FAL_KEY;
      const endpoint = process.env.FAL_IMAGE_MODEL || "fal-ai/flux-2-pro";
      if (!key || !/^[a-zA-Z0-9._/-]+$/.test(endpoint) || endpoint.includes("..")) return Response.json({ error: "FLUX عبر fal يحتاج FAL_KEY ونقطة نهاية FAL_IMAGE_MODEL صالحة." }, { status: 503 });
      model = endpoint;
      const sizes: Record<string, { width: number; height: number }> = {
        "1080p": { width: 1536, height: 864 },
        "2K": { width: 2048, height: 1152 }
      };
      const response = await fetch("https://fal.run/" + endpoint, {
        method: "POST",
        headers: { Authorization: "Key " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_size: sizes[resolution], output_format: "png", sync_mode: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(110000)
      });
      const data = await response.json();
      if (!response.ok || !data.images?.[0]?.url) return Response.json({ error: "تعذر إنشاء الصورة عبر FLUX. تحقق من FAL_KEY ونقطة النهاية." }, { status: 502 });
      const imageUrl = data.images[0].url as string;
      if (imageUrl.startsWith("data:")) {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return Response.json({ error: "عاد FLUX ببيانات صورة غير صالحة." }, { status: 502 });
        mimeType = match[1];
        image = match[2];
      } else {
        const imageHost = new URL(imageUrl).hostname;
        if (imageHost !== "storage.googleapis.com" && !imageHost.endsWith(".fal.media")) return Response.json({ error: "عاد FLUX برابط صورة من مضيف غير معتمد." }, { status: 502 });
        const imageResponse = await fetch(imageUrl, { cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!imageResponse.ok) return Response.json({ error: "تعذر تنزيل الصورة الناتجة من FLUX." }, { status: 502 });
        mimeType = imageResponse.headers.get("content-type") || "image/png";
        image = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");
      }
    } else if (provider === "stability") {
      const key = process.env.STABILITY_API_KEY;
      if (!key) return Response.json({ error: "Stability AI غير مربوط. أضف STABILITY_API_KEY في إعدادات الخادم." }, { status: 503 });
      const endpoint = process.env.STABILITY_IMAGE_ENDPOINT || "ultra";
      if (!["ultra", "core", "sd3-large", "sd3-large-turbo", "sd3-medium"].includes(endpoint)) return Response.json({ error: "نقطة نهاية Stability غير معروفة." }, { status: 500 });
      model = "stable-image-" + endpoint;
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("aspect_ratio", "16:9");
      form.set("output_format", "png");
      const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/" + endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + key, Accept: "image/*" },
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(110000)
      });
      if (!response.ok) return Response.json({ error: "تعذر إنشاء الصورة عبر Stability AI. تحقق من المفتاح ورصيد الحساب." }, { status: 502 });
      const imageBytes = Buffer.from(await response.arrayBuffer());
      image = imageBytes.toString("base64");
      mimeType = response.headers.get("content-type") || "image/png";
    } else {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return Response.json({ error: "OpenAI Images غير مربوط. أضف OPENAI_API_KEY في إعدادات الخادم." }, { status: 503 });
      model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
      const sizes: Record<string, string> = { "1080p": "1536x1024", "2K": "2560x1440", "4K": "3840x2160" };
      const safetyIdentifier = createHash("sha256").update(auth.user.id).digest("hex");
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size: sizes[resolution], quality: "high", output_format: "png", n: 1, safety_identifier: safetyIdentifier }),
        cache: "no-store",
        signal: AbortSignal.timeout(110000)
      });
      const data = await response.json();
      if (!response.ok) return Response.json({ error: "تعذر إنشاء الصورة عبر OpenAI. تحقق من صلاحية المفتاح وإتاحة النموذج والحجم." }, { status: 502 });
      image = data.data?.[0]?.b64_json || "";
    }

    if (!image) return Response.json({ error: "لم يرجع المحرك ملف صورة صالحاً." }, { status: 502 });
    await recordJob(auth.url, auth.token, auth.anon, auth.user.id, prompt, provider, model, resolution);
    return Response.json({ image, mimeType, resolution: provider === "stability" ? "model-default" : resolution, model, provider }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة إنشاء الصورة أو حدث خطأ غير متوقع. حاول مرة أخرى." }, { status: 500 });
  }
}
