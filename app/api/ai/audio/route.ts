import { checkDailyGenerationLimit } from ""../../../../lib/server/generation-jobs"";
import { ensureCreditBalance, chargeCredits, refundCredits, studioCreditCost, CREDIT_COSTS } from "../../../../lib/server/credits";

export const maxDuration = 90;

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string; email?: string }, token, url, anon };
}

async function recordJob(url: string, token: string, anon: string, ownerId: string, prompt: string, provider: string, model: string) {
  try {
    await fetch(url + "/rest/v1/generation_jobs", {
      method: "POST",
      headers: { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ owner_id: ownerId, service_type: "audio", prompt, status: "completed", result: { provider, model } }),
      cache: "no-store"
    });
  } catch { /* Keep generated audio available if history logging is unavailable. */ }
}

function pcmToWav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  const channels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "سجّل الدخول أولاً لإنشاء الصوت." }, { status: 401 });

  try {
    const body = await request.json() as { text?: string; provider?: string; voice?: string };
    const text = body.text?.trim();
    const provider = body.provider === "google" ? "google" : "elevenlabs";
    if (!text || text.length > 10000) return Response.json({ error: "اكتب نصاً صوتياً لا يتجاوز 10000 حرف." }, { status: 400 });
    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id, serviceType: "audio" });
    if (!usage.allowed) return Response.json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, { status: usage.reason === "limit" ? 429 : 503 });
    const creditAmount = CREDIT_COSTS.audio;
    const creditCheck = await ensureCreditBalance({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount });
    if (!creditCheck.ok) return Response.json({ error: creditCheck.error }, { status: creditCheck.status });

    let audio: Buffer;
    let mimeType: string;
    let model: string;

    if (provider === "google") {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) return Response.json({ error: "Gemini TTS غير مربوط. أضف GOOGLE_AI_API_KEY في إعدادات الاستضافة." }, { status: 503 });
      model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
      const voice = body.voice || process.env.GEMINI_TTS_VOICE || "Kore";
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: text,
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice }] }
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(80000)
      });
      const data = await response.json();
      if (!response.ok || !data.output_audio?.data) return Response.json({ error: "تعذر إنشاء الصوت عبر Gemini. تحقق من المفتاح والنموذج." }, { status: 502 });
      audio = pcmToWav(Buffer.from(data.output_audio.data, "base64"));
      mimeType = "audio/wav";
    } else {
      const key = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID;
      if (!key || !voiceId) return Response.json({ error: "ElevenLabs يحتاج مفتاح API ومعرّف صوت افتراضي في إعدادات الاستضافة." }, { status: 503 });
      model = process.env.ELEVENLABS_MODEL || "eleven_v4";
      const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) + "?output_format=mp3_44100_128", {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: model }),
        cache: "no-store",
        signal: AbortSignal.timeout(80000)
      });
      if (!response.ok) return Response.json({ error: "تعذر إنشاء الصوت عبر ElevenLabs. تحقق من المفتاح ومعرّف الصوت." }, { status: 502 });
      audio = Buffer.from(await response.arrayBuffer());
      mimeType = "audio/mpeg";
    }

    if (!audio.length) return Response.json({ error: "عاد محرك الصوت بملف فارغ." }, { status: 502 });
    const charge = await chargeCredits({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount, description: "تحويل النص إلى صوت", metadata: { provider, model } });
    if (!charge.ok) return Response.json({ error: charge.error }, { status: charge.status });
    await recordJob(auth.url, auth.token, auth.anon, auth.user.id, text, provider, model);
    return Response.json({ audio: audio.toString("base64"), mimeType, model, provider }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "انتهت مهلة إنشاء الصوت أو حدث خطأ غير متوقع." }, { status: 500 });
  }
}
