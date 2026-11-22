import { createHash } from "node:crypto";

export const maxDuration = 120;

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: "no-store"
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ id: string }>;
}

async function recordJob(request: Request, ownerId: string, serviceType: string, prompt: string, result: Record<string, unknown>) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !anon) return;
    await fetch(`${url}/rest/v1/generation_jobs`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ owner_id: ownerId, service_type: serviceType, prompt, status: "completed", result }),
      cache: "no-store"
    });
  } catch {
    // Generation should still be returned if optional job history logging is unavailable.
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return Response.json({ error: "سجّل الدخول أولاً لإنشاء الصور." }, { status: 401 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return Response.json({ error: "محرك الصور غير مربوط بعد. أضف OPENAI_API_KEY في إعدادات الاستضافة." }, { status: 503 });

    const body = await request.json() as { prompt?: string; resolution?: string };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 12000) return Response.json({ error: "اكتب وصفاً للصورة لا يتجاوز 12000 حرف." }, { status: 400 });

    const sizes: Record<string, string> = {
      "1080p": "1536x1024",
      "2K": "2560x1440",
      "4K": "3840x2160"
    };
    const resolution = body.resolution && sizes[body.resolution] ? body.resolution : "2K";
    const safetyIdentifier = createHash("sha256").update(user.id).digest("hex");

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
        prompt,
        size: sizes[resolution],
        quality: "high",
        output_format: "png",
        n: 1,
        safety_identifier: safetyIdentifier
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(110000)
    });
    const data = await response.json();
    if (!response.ok) return Response.json({ error: "تعذر إنشاء الصورة. تحقق من صلاحية مفتاح OpenAI وإتاحة نموذج الصور وحجم الإخراج." }, { status: 502 });
    const image = data.data?.[0]?.b64_json;
    if (typeof image !== "string" || !image) return Response.json({ error: "لم يرجع المحرك ملف صورة صالحاً." }, { status: 502 });
    await recordJob(request, user.id, "image", prompt, { model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare", resolution });
    return Response.json({
      image: image,
      mimeType: "image/png",
      resolution,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare"
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة إنشاء الصورة أو حدث خطأ غير متوقع. حاول مرة أخرى." }, { status: 500 });
  }
}
