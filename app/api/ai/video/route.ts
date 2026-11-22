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
    const body = await request.json() as { prompt?: string; resolution?: string; provider?: string; duration?: number };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 12000) return Response.json({ error: "اكتب وصفاً للفيديو لا يتجاوز 12000 حرف." }, { status: 400 });
    const provider = body.provider === "runway" ? "runway" : body.provider === "luma" ? "luma" : body.provider === "google" ? "google" : "fal";
    const duration = [5, 10, 15].includes(Number(body.duration)) ? Number(body.duration) : 5;
    const usage = await checkDailyGenerationLimit({ url: auth.url, anon: auth.anon, token: auth.token, ownerId: auth.user.id, serviceType: "video" });
    if (!usage.allowed) return Response.json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, { status: usage.reason === "limit" ? 429 : 503 });
    if ((provider === "fal" || provider === "luma") && body.resolution === "4K" && usage.plan !== "pro") return Response.json({ error: "دقة 4K للفيديو متاحة لخطة Pro فقط." }, { status: 403 });
    const jobId = randomUUID();
    let requestId = "";
    let model = "";
    let resolution = "model-default";

    if (provider === "runway") {
      const key = process.env.RUNWAY_API_KEY;
      model = runwayModel() || "";
      if (!key || !model) return Response.json({ error: "Runway يحتاج RUNWAY_API_KEY ونموذج RUNWAY_VIDEO_MODEL في إعدادات الخادم." }, { status: 503 });
      if (body.resolution === "4K" && (usage.plan !== "pro" || model !== "seedance2_5")) return Response.json({ error: "دقة 4K عبر هذا المسار تتطلب خطة Pro ونموذج Seedance 2.5." }, { status: 403 });
      resolution = body.resolution === "4K" ? "4K" : "720p";
      const runwayRatio = resolution === "4K" ? "3840:2160" : "1280:720";
      const submitted = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
        body: JSON.stringify({ model, promptText: prompt, ratio: runwayRatio, duration }),
        cache: "no-store",
        signal: AbortSignal.timeout(50000)
      });
      const data = await submitted.json();
      if (!submitted.ok || !data.id) return Response.json({ error: "تعذر إرسال الفيديو إلى Runway. تحقق من المفتاح والنموذج والرصيد." }, { status: 502 });
      requestId = data.id;
    } else if (provider === "luma") {
      const key = process.env.LUMA_API_KEY;
      model = process.env.LUMA_VIDEO_MODEL || "ray-2";
      if (!key || !["ray-2", "ray-flash-2"].includes(model)) return Response.json({ error: "Luma يحتاج LUMA_API_KEY ونموذج ray-2 أو ray-flash-2." }, { status: 503 });
      if (body.resolution === "2K") return Response.json({ error: "Luma لا يوفّر خيار 2K في قائمة الدقات الحالية. اختر 1080p أو 4K." }, { status: 400 });
      resolution = body.resolution === "4K" ? "4K" : "1080p";
      const submitted = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations/video", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ generation_type: "video", prompt, model, aspect_ratio: "16:9", resolution: resolution === "4K" ? "4k" : "1080p", duration: "5s" }),
        cache: "no-store",
        signal: AbortSignal.timeout(50000)
      });
      const data = await submitted.json();
      if (!submitted.ok || !data.id) return Response.json({ error: "تعذر إرسال الفيديو إلى Luma. تحقق من المفتاح والنموذج والرصيد." }, { status: 502 });
      model = data.version || model;
      requestId = data.id;
    } else if (provider === "google") {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      model = process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.1-eap";
      if (!key) return Response.json({ error: "Gemini Omni Video يحتاج GOOGLE_AI_API_KEY في إعدادات الخادم." }, { status: 503 });
      if (body.resolution === "4K" || body.resolution === "2K") return Response.json({ error: "Gemini Omni Video يستخدم حالياً 720p في هذا المسار. اختر Luma للحصول على 4K." }, { status: 400 });
      resolution = "720p";
      const submitted = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: prompt, response_format: { type: "video", delivery: "uri", aspect_ratio: "16:9", resolution: "720p", duration: "6s" } }),
        cache: "no-store",
        signal: AbortSignal.timeout(50000)
      });
      const data = await submitted.json();
      if (!submitted.ok || !data.id) return Response.json({ error: "تعذر إرسال الفيديو إلى Gemini Omni. تحقق من المفتاح وإتاحة النموذج المدفوعة." }, { status: 502 });
      requestId = data.id;
    } else {
      const key = process.env.FAL_KEY;
      const falEndpoint = falModel();
      if (!key || !falEndpoint) return Response.json({ error: "fal يحتاج FAL_KEY وFAL_VIDEO_MODEL في إعدادات الخادم." }, { status: 503 });
      model = falEndpoint;
      resolution = ["1080p", "2K", "4K"].includes(body.resolution || "") ? body.resolution! : "2K";
      const resolutionField = process.env.FAL_VIDEO_RESOLUTION_FIELD || "resolution";
      const durationField = process.env.FAL_VIDEO_DURATION_FIELD || "duration";
      let defaultParams: Record<string, unknown> = {};
      try { defaultParams = JSON.parse(process.env.FAL_VIDEO_DEFAULT_PARAMS || "{}"); } catch { return Response.json({ error: "FAL_VIDEO_DEFAULT_PARAMS يجب أن يكون JSON صالحاً." }, { status: 500 }); }
      if (!defaultParams || Array.isArray(defaultParams) || typeof defaultParams !== "object") return Response.json({ error: "FAL_VIDEO_DEFAULT_PARAMS يجب أن يكون كائناً JSON." }, { status: 500 });
      if (!/^[a-zA-Z0-9_]+$/.test(resolutionField) || !/^[a-zA-Z0-9_]+$/.test(durationField)) return Response.json({ error: "أسماء حقول الدقة والمدة في إعدادات fal غير صالحة." }, { status: 500 });
      const submitted = await fetch("https://queue.fal.run/" + model, {
        method: "POST",
        headers: { Authorization: "Key " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ ...defaultParams, prompt, [resolutionField]: resolution, [durationField]: duration }),
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
    if (!requestId || !["fal", "runway", "luma", "google"].includes(provider)) return Response.json({ error: "بيانات مهمة الفيديو غير مكتملة." }, { status: 409 });

    let status = "";
    let videoUrl = "";
    let providerError = "";
    let videoUri = "";
    let videoData = "";
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
    } else if (provider === "luma") {
      const key = process.env.LUMA_API_KEY;
      if (!key) return Response.json({ error: "إعداد Luma غير مكتمل." }, { status: 503 });
      const generationResponse = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations/" + encodeURIComponent(requestId), {
        headers: { Authorization: "Bearer " + key, Accept: "application/json" }, cache: "no-store"
      });
      const generation = await generationResponse.json();
      if (!generationResponse.ok) return Response.json({ error: "تعذر فحص حالة الفيديو لدى Luma." }, { status: 502 });
      const state = String(generation.state || "").toLowerCase();
      status = state === "completed" ? "COMPLETED" : state === "failed" ? "FAILED" : "IN_PROGRESS";
      videoUrl = generation.assets?.video || "";
      if (status === "FAILED") providerError = generation.failure_reason || "فشل إنشاء الفيديو لدى Luma.";
    } else if (provider === "google") {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) return Response.json({ error: "إعداد Gemini Omni غير مكتمل." }, { status: 503 });
      const interactionResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions/" + encodeURIComponent(requestId), {
        headers: { "x-goog-api-key": key }, cache: "no-store"
      });
      const interaction = await interactionResponse.json();
      if (!interactionResponse.ok) return Response.json({ error: "تعذر فحص حالة الفيديو لدى Gemini Omni." }, { status: 502 });
      const interactionStatus = String(interaction.status || "in_progress").toLowerCase();
      status = interactionStatus === "completed" ? "COMPLETED" : interactionStatus === "failed" ? "FAILED" : "IN_PROGRESS";
      const outputVideo = interaction.output_video || (interaction.steps || []).flatMap((step: any) => step.content || []).find((part: any) => part.type === "video");
      videoUri = outputVideo?.uri || "";
      if (status === "COMPLETED" && videoUri) {
        try {
          const parsedUri = new URL(videoUri);
          const fileMatch = parsedUri.pathname.match(/\\/files\\/([^/:]+)/);
          if (parsedUri.protocol !== "https:" || parsedUri.hostname !== "generativelanguage.googleapis.com" || !fileMatch) {
            providerError = "عاد Gemini برابط ملف فيديو غير صالح.";
            status = "FAILED";
          } else {
            const fileInfoResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/files/" + encodeURIComponent(fileMatch[1]), {
              headers: { "x-goog-api-key": key }, cache: "no-store"
            });
            const fileInfo = await fileInfoResponse.json();
            if (!fileInfoResponse.ok) {
              providerError = "تعذر التحقق من ملف الفيديو لدى Gemini.";
              status = "IN_PROGRESS";
            } else if (fileInfo.state === "FAILED") {
              providerError = fileInfo.error?.message || "فشل تجهيز ملف الفيديو لدى Gemini.";
              status = "FAILED";
            } else if (fileInfo.state !== "ACTIVE") {
              status = "IN_PROGRESS";
            } else {
              const downloadResponse = await fetch(parsedUri.toString(), {
                headers: { "x-goog-api-key": key }, cache: "no-store", signal: AbortSignal.timeout(50000)
              });
              if (!downloadResponse.ok) {
                providerError = "ملف الفيديو لم يصبح جاهزاً للتنزيل بعد.";
                status = "IN_PROGRESS";
              } else {
                videoData = Buffer.from(await downloadResponse.arrayBuffer()).toString("base64");
              }
            }
          }
        } catch {
          providerError = "تعذر تنزيل ملف الفيديو من Gemini.";
          status = "IN_PROGRESS";
        }
      }
      if (status === "FAILED") providerError = providerError || interaction.error?.message || "فشل إنشاء الفيديو لدى Gemini Omni.";
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
    const nextStatus = videoUrl || videoData ? "completed" : "failed";
    const nextResult = { ...job.result, ...(videoUri ? { video_uri: videoUri } : {}), video_url: videoUrl || null, provider_error: videoUrl || videoData ? null : providerError || "لم يرجع المزود ملف فيديو صالحاً." };
    await restJob(auth.url, auth.token, auth.anon, "?id=eq." + jobId + "&owner_id=eq." + auth.user.id, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: nextStatus, result: nextResult, updated_at: new Date().toISOString() })
    });
    if (!videoUrl && !videoData) return Response.json({ status: "FAILED", error: nextResult.provider_error });
    return Response.json({ status: "COMPLETED", videoUrl: videoUrl || null, videoData: videoData || null, provider });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء استرجاع نتيجة الفيديو." }, { status: 500 });
  }
}
