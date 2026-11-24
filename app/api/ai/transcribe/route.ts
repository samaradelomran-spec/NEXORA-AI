import { randomUUID } from "node:crypto";
import { checkDailyGenerationLimit } from "../../../../lib/server/generation-jobs";
import { ensureCreditBalance, chargeCredits, refundCredits, CREDIT_COSTS } from "../../../../lib/server/credits";

export const maxDuration = 120;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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
  if (!auth) return json({ error: "سجّل الدخول أولاً لتفريغ الصوت." }, 401);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const provider = form.get("provider") === "assemblyai" ? "assemblyai" : "deepgram";
    if (!(file instanceof File) || file.size < 1) return json({ error: "اختر ملفاً صوتياً أولاً." }, 400);
    if (file.size > 25 * 1024 * 1024) return json({ error: "الحد الأقصى لحجم الملف 25 ميغابايت." }, 413);
    if (!(file.type.startsWith("audio/") || file.type.startsWith("video/") || file.type === "application/octet-stream")) return json({ error: "صيغة الملف غير مدعومة. اختر ملف صوت أو فيديو." }, 415);

    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id, serviceType: "audio" });
    if (!usage.allowed) return json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي لإنشاء الصوت." : "تعذر التحقق من حد الاستخدام." }, usage.reason === "limit" ? 429 : 503);
    const creditAmount = CREDIT_COSTS.transcription;
    const creditCheck = await ensureCreditBalance({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount });
    if (!creditCheck.ok) return json({ error: creditCheck.error }, creditCheck.status);

    const bytes = Buffer.from(await file.arrayBuffer());
    if (provider === "deepgram") {
      const key = process.env.DEEPGRAM_API_KEY;
      if (!key) return json({ error: "Deepgram غير مربوط. أضف DEEPGRAM_API_KEY في إعدادات الخادم." }, 503);
      const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true", {
        method: "POST",
        headers: { Authorization: "Token " + key, "Content-Type": file.type || "application/octet-stream" },
        body: bytes,
        cache: "no-store",
        signal: AbortSignal.timeout(110000)
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر تفريغ الملف عبر Deepgram. تحقق من المفتاح والصيغة والرصيد." }, 502);
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
      if (!transcript) return json({ error: "لم يتم التعرف على كلام واضح في الملف." }, 422);
      const charge = await chargeCredits({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount, description: "تفريغ ملف صوتي", metadata: { provider, model: "nova-3" } });
      if (!charge.ok) return json({ error: charge.error }, charge.status);
      return json({ status: "COMPLETED", provider, transcript });
    }

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) return json({ error: "AssemblyAI غير مربوط. أضف ASSEMBLYAI_API_KEY في إعدادات الخادم." }, 503);
    const upload = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: key, "content-type": "application/octet-stream" },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(110000)
    });
    const uploaded = await upload.json();
    if (!upload.ok || !uploaded.upload_url) return json({ error: "تعذر رفع الملف إلى AssemblyAI. تحقق من المفتاح وحجم الملف." }, 502);

    const submitted = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: uploaded.upload_url, speech_models: ["universal-3-5-pro", "universal-2"], language_detection: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(50000)
    });
    const task = await submitted.json();
    if (!submitted.ok || !task.id) return json({ error: "تعذر إرسال الملف إلى AssemblyAI للتفريغ." }, 502);
    const jobId = randomUUID();
    const saved = await jobsRest(auth.url, auth.token, auth.anon, "", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: jobId, owner_id: auth.user.id, service_type: "audio", prompt: "تفريغ صوت: " + file.name.slice(0, 180), status: "queued", result: { provider, request_id: task.id } })
    });
    if (!saved.ok) return json({ error: "أُرسلت مهمة التفريغ لكن تعذر حفظها في حسابك." }, 500);
    const charge = await chargeCredits({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: creditAmount, description: "تفريغ ملف صوتي", idempotencyKey: jobId, metadata: { provider, requestId: task.id, jobId } });
    if (!charge.ok) {
      await jobsRest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", result: { provider, request_id: task.id, provider_error: charge.error } }) });
      return json({ error: charge.error }, charge.status);
    }
    await jobsRest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ result: { provider, request_id: task.id, credit_amount: creditAmount, credit_charge_id: jobId } }) });
    return json({ status: "IN_PROGRESS", provider, jobId });
  } catch {
    return json({ error: "حدث خطأ أثناء تفريغ الملف الصوتي." }, 500);
  }
}

export async function GET(request: Request) {
  const auth = await getUser(request);
  if (!auth) return json({ error: "انتهت جلسة الدخول. سجّل الدخول مجدداً." }, 401);
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "معرّف المهمة غير صالح." }, 400);
  try {
    const lookup = await jobsRest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id + "&select=id,status,result&limit=1", { method: "GET" });
    if (!lookup.ok) return json({ error: "تعذر قراءة مهمة التفريغ." }, 502);
    const job = (await lookup.json())?.[0];
    if (!job || job.result?.provider !== "assemblyai") return json({ error: "مهمة التفريغ غير موجودة في حسابك." }, 404);
    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) return json({ error: "إعداد AssemblyAI غير مكتمل." }, 503);
    const response = await fetch("https://api.assemblyai.com/v2/transcript/" + encodeURIComponent(job.result.request_id), {
      headers: { authorization: key }, cache: "no-store", signal: AbortSignal.timeout(30000)
    });
    const task = await response.json();
    if (!response.ok) return json({ error: "تعذر فحص حالة التفريغ لدى AssemblyAI." }, 502);
    if (task.status === "queued" || task.status === "processing") return json({ status: "IN_PROGRESS" });
    const completed = task.status === "completed" && typeof task.text === "string" && task.text.length > 0;
    const nextResult = { ...job.result, transcript: completed ? task.text : null, provider_error: completed ? null : task.error || "تعذر تفريغ الملف لدى AssemblyAI." };
    if (!completed && Number(job.result?.credit_amount) > 0 && !job.result?.credit_refunded) {
      const refund = await refundCredits({ url: auth.url, ownerId: auth.user.id, email: auth.user.email, amount: Number(job.result.credit_amount), description: "إعادة نقاط تفريغ صوتي فشل", idempotencyKey: jobId, metadata: { provider: "assemblyai", jobId } });
      if (!refund.ok) return json({ error: refund.error }, refund.status);
      nextResult.credit_refunded = true;
    }
    await jobsRest(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: completed ? "completed" : "failed", result: nextResult, updated_at: new Date().toISOString() })
    });
    if (!completed) return json({ status: "FAILED", error: nextResult.provider_error });
    return json({ status: "COMPLETED", provider: "assemblyai", transcript: task.text });
  } catch {
    return json({ error: "حدث خطأ أثناء استرجاع نتيجة التفريغ." }, 500);
  }
}
