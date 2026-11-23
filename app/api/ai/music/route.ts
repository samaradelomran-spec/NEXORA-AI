import { checkDailyGenerationLimit } from "../../../../lib/server/generation-jobs";
import { ensureCreditBalance, chargeCredits, refundCredits, CREDIT_COSTS } from "../../../../lib/server/credits";

import { randomUUID } from "node:crypto";

export const maxDuration = 60;

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string; email?: string }, token, url, anon };
}

async function jobsRest(url: string, token: string, anon: string, path: string, init: RequestInit) {
  return fetch(url + "/rest/v1/generation_jobs" + path, {
    ...init,
    headers: { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store"
  });
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "سجّل الدخول أولاً لإنشاء الموسيقى." }, { status: 401 });
  const key = process.env.RUNWAY_API_KEY;
  if (!key) return Response.json({ error: "إنشاء الموسيقى يحتاج RUNWAY_API_KEY في إعدادات الخادم." }, { status: 503 });

  try {
    const body = await request.json() as { prompt?: string; duration?: number; instrumental?: boolean; kind?: string };
    const prompt = body.prompt?.trim();
    const kind = body.kind === "sfx" ? "sfx" : "music";
    const promptLimit = kind === "sfx" ? 2048 : 4100;
    if (!prompt || prompt.length > promptLimit) return Response.json({ error: kind === "sfx" ? "وصف المؤثر الصوتي يجب ألا يتجاوز 2048 حرفاً." : "اكتب وصفاً موسيقياً لا يتجاوز 4100 حرف." }, { status: 400 });
    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id, serviceType: kind === "sfx" ? "sound_effect" : "music" });
    if (!usage.allowed) return Response.json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, { status: usage.reason === "limit" ? 429 : 503 });
    const creditAmount = kind === "sfx" ? CREDIT_COSTS.sound_effect : CREDIT_COSTS.music;
    const creditCheck = await ensureCreditBalance({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount });
    if (!creditCheck.ok) return Response.json({ error: creditCheck.error }, { status: creditCheck.status });
    const durationOptions = body.kind === "sfx" ? [5, 10, 15, 30] : [15, 30, 60, 90];
    const duration = durationOptions.includes(Number(body.duration)) ? Number(body.duration) : (body.kind === "sfx" ? 10 : 30);
    const model = kind === "sfx" ? process.env.RUNWAY_SFX_MODEL : process.env.RUNWAY_MUSIC_MODEL;
    if (!model?.trim()) return Response.json({ error: kind === "sfx" ? "أضف RUNWAY_SFX_MODEL من النماذج المتاحة في حسابك." : "أضف RUNWAY_MUSIC_MODEL من النماذج المتاحة في حسابك." }, { status: 503 });
    const endpoint = kind === "sfx" ? "sound_effect" : "text_to_music";
    const requestBody = kind === "sfx" ? { model, promptText: prompt, duration, loop: false, outputFormat: "mp3" } : { model, promptText: prompt, duration, instrumental: Boolean(body.instrumental) };
    const submitted = await fetch("https://api.dev.runwayml.com/v1/" + endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: AbortSignal.timeout(50000)
    });
    const data = await submitted.json();
    if (!submitted.ok || !data.id) return Response.json({ error: "تعذر إرسال الصوت إلى Runway. تحقق من المفتاح والنموذج والرصيد." }, { status: 502 });

    const jobId = randomUUID();
    const saved = await jobsRest(auth.url, auth.token, auth.anon, "", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: jobId, owner_id: auth.user.id, service_type: kind === "sfx" ? "sound_effect" : "music", prompt, status: "queued", result: { provider: "runway", model, request_id: data.id, duration, kind } })
    });
    if (!saved.ok) return Response.json({ error: "تم إرسال الموسيقى لكن تعذر تسجيل المهمة في حسابك." }, { status: 500 });
    const charge = await chargeCredits({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount, description: kind === "sfx" ? "إنشاء مؤثر صوتي" : "إنشاء موسيقى", idempotencyKey: jobId, metadata: { provider: "runway", model, kind, jobId } });
    if (!charge.ok) {
      await jobsRest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", result: { provider: "runway", model, request_id: data.id, provider_error: charge.error } }) });
      return Response.json({ error: charge.error }, { status: charge.status });
    }
    await rest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ result: { provider: "runway", model, request_id: data.id, duration, kind, credit_amount: creditAmount, credit_charge_id: jobId } }) });
    return Response.json({ jobId, status: "PENDING" });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء إرسال مهمة الموسيقى." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "انتهت جلسة الدخول. سجّل الدخول مجدداً." }, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ error: "معرّف المهمة غير صالح." }, { status: 400 });
  const key = process.env.RUNWAY_API_KEY;
  if (!key) return Response.json({ error: "إعداد Runway غير مكتمل." }, { status: 503 });

  try {
    const lookup = await jobsRest(auth.url, auth.token, auth.anon,
      "?id=eq." + jobId + "&owner_id=eq." + auth.user.id + "&select=id,status,result&limit=1", { method: "GET" });
    if (!lookup.ok) return Response.json({ error: "تعذر قراءة سجل المهمة." }, { status: 502 });
    const rows = await lookup.json();
    const job = rows?.[0];
    if (!job || job.result?.provider !== "runway") return Response.json({ error: "المهمة غير موجودة في حسابك." }, { status: 404 });
    const requestId = job.result?.request_id;
    if (!requestId) return Response.json({ error: "بيانات مهمة الموسيقى غير مكتملة." }, { status: 409 });

    const response = await fetch("https://api.dev.runwayml.com/v1/tasks/" + encodeURIComponent(requestId), {
      headers: { Authorization: "Bearer " + key, "X-Runway-Version": "2024-11-06" }, cache: "no-store"
    });
    const task = await response.json();
    if (!response.ok) return Response.json({ error: "تعذر فحص حالة الموسيقى لدى Runway." }, { status: 502 });
    const status = task.status || "PENDING";
    if (status !== "SUCCEEDED" && status !== "FAILED" && status !== "CANCELED") return Response.json({ status });

    const output = Array.isArray(task.output) ? task.output[0] : task.output;
    const audioUrl = typeof output === "string" ? output : output?.url || "";
    const completed = status === "SUCCEEDED" && Boolean(audioUrl);
    const result = { ...job.result, audio_url: audioUrl || null, provider_error: completed ? null : task.failure || "فشل إنشاء الصوت." };
    if (!completed && Number(job.result?.credit_amount) > 0 && !job.result?.credit_refunded) {
      const refund = await refundCredits({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: Number(job.result.credit_amount), description: "إعادة نقاط مهمة صوتية فشلت", idempotencyKey: jobId, metadata: { provider: "runway", jobId } });
      if (!refund.ok) return Response.json({ error: refund.error }, { status: refund.status });
      result.credit_refunded = true;
    }
    await jobsRest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: completed ? "completed" : "failed", result, updated_at: new Date().toISOString() })
    });
    if (!completed) return Response.json({ status: "FAILED", error: result.provider_error });
    return Response.json({ status: "COMPLETED", audioUrl });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء استرجاع الموسيقى." }, { status: 500 });
  }
}
