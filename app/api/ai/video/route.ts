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
  const key = process.env.FAL_KEY;
  const model = falModel();
  if (!key || !model) return Response.json({ error: "محرك الفيديو غير مُعد بعد. يلزم FAL_KEY وFAL_VIDEO_MODEL في إعدادات الاستضافة." }, { status: 503 });

  try {
    const body = await request.json() as { prompt?: string; resolution?: string };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 12000) return Response.json({ error: "اكتب وصفاً للفيديو لا يتجاوز 12000 حرف." }, { status: 400 });

    const resolution = ["1080p", "2K", "4K"].includes(body.resolution || "") ? body.resolution! : "2K";
    const resolutionField = process.env.FAL_VIDEO_RESOLUTION_FIELD || "resolution";
    if (!/^[a-zA-Z0-9_]+$/.test(resolutionField)) return Response.json({ error: "اسم حقل الدقة في إعدادات fal غير صالح." }, { status: 500 });
    const submitted = await fetch("https://queue.fal.run/" + model, {
      method: "POST",
      headers: { Authorization: "Key " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, [resolutionField]: resolution }),
      cache: "no-store"
    });
    const data = await submitted.json();
    if (!submitted.ok || !data.request_id) return Response.json({ error: "تعذر إرسال مهمة الفيديو إلى fal. تحقق من نقطة النهاية ومفتاح الحساب." }, { status: 502 });

    const jobId = randomUUID();
    const saved = await restJob(auth.url, auth.token, auth.anon, "", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: jobId, owner_id: auth.user.id, service_type: "video", prompt, status: "queued",
        result: { provider: "fal", model, request_id: data.request_id, resolution }
      })
    });
    if (!saved.ok) {
      if (data.cancel_url) await fetch(data.cancel_url, { method: "PUT", headers: { Authorization: "Key " + key } }).catch(() => undefined);
      return Response.json({ error: "تعذر تسجيل المهمة في سجل حسابك، لذلك أوقفنا إرسالها." }, { status: 500 });
    }
    return Response.json({ jobId, requestId: data.request_id, status: data.status || "IN_QUEUE" });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء إرسال مهمة الفيديو." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "انتهت جلسة الدخول. سجّل الدخول مجدداً." }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  const jobId = searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ error: "معرّف المهمة غير صالح." }, { status: 400 });
  const key = process.env.FAL_KEY;
  const model = falModel();
  if (!key || !model) return Response.json({ error: "إعداد fal غير مكتمل." }, { status: 503 });

  try {
    const lookup = await restJob(auth.url, auth.token, auth.anon,
      "?id=eq." + jobId + "&owner_id=eq." + auth.user.id + "&select=id,status,result,prompt&limit=1", { method: "GET" });
    if (!lookup.ok) return Response.json({ error: "تعذر قراءة سجل المهمة." }, { status: 502 });
    const rows = await lookup.json();
    const job = rows?.[0];
    if (!job) return Response.json({ error: "المهمة غير موجودة في حسابك." }, { status: 404 });
    const requestId = job.result?.request_id;
    const savedModel = job.result?.model;
    if (!requestId || savedModel !== model) return Response.json({ error: "بيانات مهمة الفيديو غير مكتملة أو تغيرت نقطة النهاية." }, { status: 409 });

    const statusResponse = await fetch("https://queue.fal.run/" + model + "/requests/" + requestId + "/status", {
      headers: { Authorization: "Key " + key }, cache: "no-store"
    });
    const state = await statusResponse.json();
    if (!statusResponse.ok) return Response.json({ error: "تعذر فحص حالة الفيديو لدى المزود." }, { status: 502 });
    if (state.status !== "COMPLETED") return Response.json({ status: state.status, queuePosition: state.queue_position ?? null });

    const resultResponse = await fetch("https://queue.fal.run/" + model + "/requests/" + requestId, {
      headers: { Authorization: "Key " + key }, cache: "no-store"
    });
    const result = await resultResponse.json();
    const videoUrl = result.video?.url || result.video_url || result.output?.video?.url || result.url;
    const nextStatus = videoUrl ? "completed" : "failed";
    const nextResult = { ...job.result, video_url: videoUrl || null, provider_error: videoUrl ? null : "لم يرجع المزود رابط فيديو." };
    await restJob(auth.url, auth.token, auth.anon,
      "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: nextStatus, result: nextResult, updated_at: new Date().toISOString() })
      });
    if (!videoUrl) return Response.json({ status: "FAILED", error: "انتهى الطلب دون رابط فيديو صالح." });
    return Response.json({ status: "COMPLETED", videoUrl });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء استرجاع نتيجة الفيديو." }, { status: 500 });
  }
}
