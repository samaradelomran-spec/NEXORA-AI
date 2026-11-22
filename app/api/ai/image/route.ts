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
    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id });
    if (!usage.allowed) return Response.json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, { status: usage.reason === "limit" ? 429 : 503 });

    const resolution = ["1080p", "2K", "4K"].includes(body.resolution || "") ? body.resolution! : "2K";
    const provider = body.provider === "google" ? "google" : "openai";
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
    return Response.json({ image, mimeType, resolution, model, provider }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة إنشاء الصورة أو حدث خطأ غير متوقع. حاول مرة أخرى." }, { status: 500 });
  }
}
