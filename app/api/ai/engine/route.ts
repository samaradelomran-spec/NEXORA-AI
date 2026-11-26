import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Task = "chat" | "image" | "video" | "audio" | "music" | "transcribe";
const routes: Record<Task, string> = {
  chat: "/api/ai/chat",
  image: "/api/ai/image",
  video: "/api/ai/video",
  audio: "/api/ai/audio",
  music: "/api/ai/music",
  transcribe: "/api/ai/transcribe"
};

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function choose(task: Task): string | null {
  const candidates: Record<Task, Array<[string, string[]]>> = {
    chat: [
      ["openai", ["OPENAI_API_KEY", "OPENAI_MODEL"]],
      ["google", ["GOOGLE_AI_API_KEY", "GEMINI_MODEL"]],
      ["google", ["GEMINI_API_KEY", "GEMINI_MODEL"]],
      ["anthropic", ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]],
      ["deepseek", ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL"]],
      ["groq", ["GROQ_API_KEY", "GROQ_MODEL"]],
      ["mistral", ["MISTRAL_API_KEY", "MISTRAL_MODEL"]],
      ["xai", ["XAI_API_KEY", "XAI_MODEL"]],
      ["cohere", ["COHERE_API_KEY", "COHERE_MODEL"]],
      ["together", ["TOGETHER_API_KEY", "TOGETHER_MODEL"]],
      ["fireworks", ["FIREWORKS_API_KEY", "FIREWORKS_MODEL"]]
    ],
    image: [
      ["google", ["GOOGLE_AI_API_KEY", "GEMINI_IMAGE_MODEL"]],
      ["google", ["GEMINI_API_KEY", "GEMINI_IMAGE_MODEL"]],
      ["openai", ["OPENAI_API_KEY", "OPENAI_IMAGE_MODEL"]],
      ["fal", ["FAL_KEY", "FAL_IMAGE_MODEL"]],
      ["stability", ["STABILITY_API_KEY"]]
    ],
    video: [
      ["fal", ["FAL_KEY", "FAL_VIDEO_MODEL"]],
      ["runway", ["RUNWAY_API_KEY", "RUNWAY_VIDEO_MODEL"]],
      ["luma", ["LUMA_API_KEY", "LUMA_VIDEO_MODEL"]],
      ["kling", ["KLING_API_KEY"]],
      ["google", ["GOOGLE_AI_API_KEY", "GEMINI_VIDEO_MODEL"]],
      ["google", ["GEMINI_API_KEY", "GEMINI_VIDEO_MODEL"]]
    ],
    audio: [
      ["elevenlabs", ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID", "ELEVENLABS_MODEL"]],
      ["google", ["GOOGLE_AI_API_KEY", "GEMINI_TTS_MODEL"]],
      ["google", ["GEMINI_API_KEY", "GEMINI_TTS_MODEL"]]
    ],
    music: [["runway", ["RUNWAY_API_KEY", "RUNWAY_MUSIC_MODEL"]]],
    transcribe: [
      ["deepgram", ["DEEPGRAM_API_KEY"]],
      ["assemblyai", ["ASSEMBLYAI_API_KEY"]]
    ]
  };
  return candidates[task].find(([, keys]) => keys.every(configured))?.[0] ?? null;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let taskValue: string | null = null;
  let body: Record<string, unknown> | null = null;
  let form: FormData | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      form = await request.formData();
      taskValue = String(form.get("task") || "");
    } else {
      body = await request.json() as Record<string, unknown>;
      taskValue = typeof body.task === "string" ? body.task : null;
    }
  } catch {
    return Response.json({ error: "تعذر قراءة طلب NEXORA CORE." }, { status: 400 });
  }

  if (!taskValue || !(taskValue in routes)) {
    return Response.json({ error: "حدد نوع مهمة مدعوماً: chat, image, video, audio, music, transcribe." }, { status: 400 });
  }
  const task = taskValue as Task;
  const requested = typeof body?.provider === "string" ? body.provider : typeof form?.get("provider") === "string" ? String(form?.get("provider")) : "";
  const provider = requested || choose(task);
  if (!provider) {
    return Response.json({
      error: "لا يوجد مزوّد مهيأ لهذه المهمة. أضف مفاتيح API ومعرّفات النماذج المطلوبة في إعدادات الخادم.",
      task,
      setup: true
    }, { status: 503 });
  }

  if (body) {
    delete body.task;
    body.provider = provider;
  } else if (form) {
    form.delete("task");
    form.set("provider", provider);
  }

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  if (body) headers.set("content-type", "application/json");
  const target = new URL(routes[task], request.url);
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : form,
      cache: "no-store",
      signal: AbortSignal.timeout(125000)
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
        "x-nexora-core": "1",
        "x-nexora-provider": provider
      }
    });
  } catch {
    return Response.json({ error: "تعذر الوصول إلى محرك التنفيذ الداخلي. حاول مجدداً." }, { status: 502 });
  }
}
