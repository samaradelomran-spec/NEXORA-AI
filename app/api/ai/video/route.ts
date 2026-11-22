import { checkDailyGenerationLimit } from "../../../../lib/server/generation-jobs";

import { randomUUID } from "node:crypto";

export const maxDuration = 60;

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string }, token, url, anon };
}

function falModel() {
  const model = process.env.FAL_VIDEO_MODEL || "";
  if (!model || model.includes("..") || !/^[a-zA-Z0-9._/-]+$/.test(model)) return null;
  return model.replace(/^\/+|\/+$/g, "");
}

function runwayModel() {
  const model = process.env.RUNWAY_VIDEO_MODEL || "seedance2_5";
  return /^[a-zA-Z0-9._-]+$/.test(model) ? model : null;
}

async function restJob(url: string, token: string, anon: string, path: string, init: RequestInit) {
  return fetch(url + "/rest/v1/generation_jobs" + path, {
    ...init,
    headers: { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store"
  });
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "سجّل الدخول أولاً لإنشاء الفيديو." }, { status: 401 });

  try {
    const body = await request.json() as { prompt?: string; resolution?: string; provider?: string };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 12000) return Response.json({ error: "اكتب وصفاً للفيديو لا يتجاوز 12000 حرف." }, { status: 400 });
    const provider = body.provider === "runway" ? "runway" : "fal";
    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id, serviceType: "video" });
    if (!usage.allowed) return Response.json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, { status: usage.reason === "limit" ? 429 : 503 });
    if (provider === "fal" && body.resolution === "4K" && usage.plan !== "pro") return Response.json({ error: "دقة 4K للفيديو متاحة لخطة Pro فقط." }, { status: 403 });
    const jobId = randomUUID();
    let requestId = "";
    let model = "";
    let resolution = "model-default";

    if (provider === "runway") {
      const key = process.env.RUNWAY_API_KEY;
      model = runwayModel() || "";
      if (!key || !model) return Response.json({ error: "Runway يحتاج RUNWAY_API_KEY ونموذج RUNWAY_VIDEO_MODEL في إعدادات الخادم." }, { status: 503 });
      const submitted = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
        body: JSON.stringify({ model, promptText: prompt, ratio: "1920:1080", duration: 5 }),
        cache: "no-store",
        signal: AbortSignal.timeout(50000)
      });
      const data = await submitted.json();
      if (!submitted.ok || !data.id) return Response.json({ error: "تعذر إرسال الفيديو إلى Runway. تحقق من المفتاح والنموذج والرصيد." }, { status: 502 });
      requestId = data.id;
    } else {
      const key = process.env.FAL_KEY;
      const falEndpoint = falModel();
      if (!key || !falEndpoint) return Response.json({ error: "fal يحتاج FAL_KEY وFAL_VIDEO_MODEL في إعدادات الخادم." }, { status: 503 });
      model = falEndpoint;
      resolution = ["1080p", "2K", "4K"].includes(body.resolution || "") ? body.resolution! : "2K";
      const resolutionField = process.env.FAL_VIDEO_RESOLUTION_FIELD || "resolution";
      if (!/^[a-zA-Z0-9_]+$/.test(resolutionField)) return Response.json({ error: "اسم حقل الدقة في إعدادات fal غير صالح." }, { status: 500 });
      const submitted = await fetch("https://queue.fal.run/" + model, {
        method: "POST",
        headers: { Authorization: "Key " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, [resolutionField]: resolution }),
        cache: "no-store",
        signal: AbortSignal.timeout(50000)
      });
      const data = await submitted.json();
      if (!submitted.ok || !data.request_id) return Response.json({ error: "تعذر إرسال مهمة الفيديو إلى fal. تحقق من نقطة النهاية ومفتاح الحساب." }, { status: 502 });
      requestId = data.request_id;
    }

    const saved = await restJob(auth.url, auth.token, auth.anon, "", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: jobId, owner_id: auth.user.id, service_type: "video", prompt, status: "queued",
        result: { provider, model, request_id: requestId, resolution }
      })
    });
    if (!saved.ok) return Response.json({ error: "تم إرسال المهمة لكن تعذر تسجيلها في حسابك. راجع إعدادات قاعدة البيانات." }, { status: 500 });
    return Response.json({ jobId, requestId, provider, status: "IN_QUEUE", resolution });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء إرسال مهمة الفيديو." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "انتهت جلسة الدخول. سجّل الدخول مجدداً." }, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ error: "معرّف المهمة غير صالح." }, { status: 400 });

  try {
    const lookup = await restJob(auth.url, auth.token, auth.anon,
      "?id=eq." + jobId + "&owner_id=eq." + auth.user.id + "&select=id,status,result,prompt&limit=1", { method: "GET" });
    if (!lookup.ok) return Response.json({ error: "تعذر قراءة سجل المهمة." }, { status: 502 });
    const rows = await lookup.json();
    const job = rows?.[0];
    if (!job) return Response.json({ error: "المهمة غير موجودة في حسابك." }, { status: 404 });
    const requestId = job.result?.request_id;
    const provider = job.result?.provider;
    const model = job.result?.model;
    if (!requestId || !["fal", "runway"].includes(provider)) return Response.json({ error: "بيانات مهمة الفيديو غير مكتملة." }, { status: 409 });

    let status = "";
    let videoUrl = "";
    let providerError = "";
    if (provider === "runway") {
      const key = process.env.RUNWAY_API_KEY;
      if (!key || model !== runwayModel()) return Response.json({ error: "إعداد Runway تغيّر أو غير مكتمل." }, { status: 503 });
      const taskResponse = await fetch("https://api.dev.runwayml.com/v1/tasks/" + encodeURIComponent(requestId), {
        headers: { Authorization: "Bearer " + key, "X-Runway-Version": "2024-11-06" }, cache: "no-store"
      });
      const task = await taskResponse.json();
      if (!taskResponse.ok) return Response.json({ error: "تعذر فحص حالة المهمة لدى Runway." }, { status: 502 });
      status = task.status || "PENDING";
      if (status === "SUCCEEDED") {
        const output = Array.isArray(task.output) ? task.output[0] : task.output;
        videoUrl = typeof output === "string" ? output : output?.url || "";
      }
      if (status === "FAILED") providerError = task.failure || task.failureCode || "فشل إنشاء الفيديو لدى Runway.";
    } else {
      const key = process.env.FAL_KEY;
      if (!key || model !== falModel()) return Response.json({ error: "إعداد fal تغيّر أو غير مكتمل." }, { status: 503 });
      const statusResponse = await fetch("https://queue.fal.run/" + model + "/requests/" + requestId + "/status", {
        headers: { Authorization: "Key " + key }, cache: "no-store"
      });
      const state = await statusResponse.json();
      if (!statusResponse.ok) return Response.json({ error: "تعذر فحص حالة الفيديو لدى fal." }, { status: 502 });
      status = state.status || "IN_QUEUE";
      if (status === "FAILED") providerError = state.error || "فشل إنشاء الفيديو لدى fal.";
      if (status === "COMPLETED") {
        const resultResponse = await fetch("https://queue.fal.run/" + model + "/requests/" + requestId, {
          headers: { Authorization: "Key " + key }, cache: "no-store"
        });
        const result = await resultResponse.json();
        videoUrl = result.video?.url || result.video_url || result.output?.video?.url || result.url || "";
      }
    }

    const finished = status === "SUCCEEDED" || status === "COMPLETED" || status === "FAILED" || status === "CANCELED" || status === "CANCELLED";
    if (!finished) return Response.json({ status, queuePosition: null });
    const nextStatus = videoUrl ? "completed" : "failed";
    const nextResult = { ...job.result, video_url: videoUrl || null, provider_error: videoUrl ? null : providerError || "لم يرجع المزود رابط فيديو صالحاً." };
    await restJob(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: nextStatus, result: nextResult, updated_at: new Date().toISOString() })
    });
    if (!videoUrl) return Response.json({ status: "FAILED", error: nextResult.provider_error });
    return Response.json({ status: "COMPLETED", videoUrl, provider });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء استرجاع نتيجة الفيديو." }, { status: 500 });
  }
}
