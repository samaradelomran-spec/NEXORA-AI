import { createHash } from "node:crypto";

export const maxDuration = 90;

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string }, token, url, anon };
}

async function recordJob(url: string, token: string, anon: string, ownerId: string, prompt: string, model: string) {
  try {
    await fetch(url + "/rest/v1/generation_jobs", {
      method: "POST",
      headers: { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ owner_id: ownerId, service_type: "audio", prompt, status: "completed", result: { provider: "elevenlabs", model } }),
      cache: "no-store"
    });
  } catch { /* Keep the generated audio available if history logging is unavailable. */ }
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "سجّل الدخول أولاً لإنشاء الصوت." }, { status: 401 });
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!key || !voiceId) return Response.json({ error: "محرك الصوت يحتاج ELEVENLABS_API_KEY وELEVENLABS_DEFAULT_VOICE_ID في إعدادات الاستضافة." }, { status: 503 });

  try {
    const body = await request.json() as { text?: string };
    const text = body.text?.trim();
    if (!text || text.length > 10000) return Response.json({ error: "اكتب نصاً صوتياً لا يتجاوز 10000 حرف." }, { status: 400 });
    const model = process.env.ELEVENLABS_MODEL || "eleven_v4";
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) + "?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
      cache: "no-store",
      signal: AbortSignal.timeout(80000)
    });
    if (!response.ok) return Response.json({ error: "تعذر إنشاء الصوت. تحقق من صلاحية مفتاح ElevenLabs ومعرّف الصوت." }, { status: 502 });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return Response.json({ error: "عاد محرك الصوت بملف فارغ." }, { status: 502 });
    await recordJob(auth.url, auth.token, auth.anon, auth.user.id, text, model);
    return Response.json({ audio: bytes.toString("base64"), mimeType: "audio/mpeg", model }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة إنشاء الصوت أو حدث خطأ غير متوقع." }, { status: 500 });
  }
}
