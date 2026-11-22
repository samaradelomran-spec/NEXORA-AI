type ChatMessage = { role: "user" | "assistant"; content: string };
type Provider = "openai" | "anthropic" | "google";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function getAuthenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store"
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

function extractOpenAI(data: any) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || []).flatMap((item: any) => item.content || [])
    .filter((part: any) => part.type === "output_text" && typeof part.text === "string")
    .map((part: any) => part.text).join("\n");
}

function extractGoogle(data: any) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.steps || []).filter((step: any) => step.type === "model_output")
    .flatMap((step: any) => step.content || [])
    .filter((part: any) => part.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text).join("\n");
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return json({ error: "سجّل الدخول أولاً حتى تستخدم المساعد الذكي." }, 401);

    const body = await request.json() as { provider?: Provider; messages?: ChatMessage[]; studio?: string };
    const provider = body.provider;
    const messages = body.messages;
    const studio = ["web", "games", "cinema", "series"].includes(body.studio || "") ? body.studio! : "assistant";
    if (!["openai", "anthropic", "google"].includes(String(provider))) {
      return json({ error: "اختر محركاً مدعوماً." }, 400);
    }
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
      return json({ error: "المحادثة غير صالحة أو طويلة جداً." }, 400);
    }
    const safeMessages = messages.filter((item) =>
      item && (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" && item.content.trim().length > 0 && item.content.length <= 12000
    );
    if (safeMessages.length !== messages.length || safeMessages.reduce((sum, item) => sum + item.content.length, 0) > 30000) {
      return json({ error: "حجم الرسائل أكبر من الحد المسموح." }, 400);
    }
    if (safeMessages[safeMessages.length - 1]?.role !== "user") {
      return json({ error: "آخر رسالة يجب أن تكون من المستخدم." }, 400);
    }

    const studioInstructions: Record<string, string> = {
      assistant: "أنت مساعد NEXORA AI. أجب بدقة ووضوح، وبلغة المستخدم، ولا تدّع تنفيذ إجراءات أو إنشاء ملفات لم تنفذها فعلياً.",
      web: "أنت مهندس برمجيات ومطور مواقع وتطبيقات في NEXORA AI. أنشئ خطة تنفيذ واضحة ثم أمثلة كود عملية قابلة للتشغيل، مع هيكل الملفات وتعليمات التشغيل. اسأل فقط إذا كانت معلومة أساسية ناقصة. لا تدّع أنك نشرت الموقع.",
      games: "أنت مصمم ألعاب ومهندس تطوير ألعاب في NEXORA AI. أنشئ وثيقة تصميم لعبة تشمل الفكرة والميكانيكيات والمراحل والشخصيات وواجهة اللعب، وأضف نموذج كود أولي عند الحاجة. لا تدّع أنك بنيت ملف لعبة جاهزاً ما لم تفعل ذلك.",
      cinema: "أنت كاتب سيناريو ومخرج سينمائي في NEXORA AI. طوّر الفكرة إلى معالجة سينمائية ومشاهد وحوار ووصف لقطات وحركة كاميرا وصوت وإضاءة، مع الحفاظ على طلب المستخدم.",
      series: "أنت كاتب مسلسلات في NEXORA AI. ابنِ عالم المسلسل والشخصيات وأقواسها وخريطة الحلقات ثم اكتب المشاهد والحوار بالتفصيل وفق طلب المستخدم."
    };
    const systemInstruction = studioInstructions[studio];
    let response: Response;
    let answer = "";

    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return json({ error: "محرك OpenAI غير مربوط بعد. أضف OPENAI_API_KEY في إعدادات الاستضافة." }, 503);
      const input = safeMessages.map((item) => ({ role: item.role, content: item.content }));
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-6.2-astra", instructions: systemInstruction, input, max_output_tokens: 1800 }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على OpenAI إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      answer = extractOpenAI(data);
    } else if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return json({ error: "محرك Claude غير مربوط بعد. أضف ANTHROPIC_API_KEY في إعدادات الاستضافة." }, 503);
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2026-10-21", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          system: systemInstruction,
          messages: safeMessages.map((item) => ({ role: item.role, content: item.content })),
          max_tokens: 1800
        }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على Claude إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      answer = (data.content || []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
    } else {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) return json({ error: "محرك Gemini غير مربوط بعد. أضف GOOGLE_AI_API_KEY في إعدادات الاستضافة." }, 503);
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
          store: false,
          input: safeMessages.map((item) => ({
            type: item.role === "assistant" ? "model_output" : "user_input",
            content: [{ type: "text", text: item.content }]
          }))
        }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على Gemini إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      answer = extractGoogle(data);
    }

    if (!answer.trim()) return json({ error: "عاد المحرك برد فارغ. جرّب مرة أخرى." }, 502);
    await recordJob(request, user.id, studio, safeMessages[safeMessages.length - 1].content, { provider });
    return json({ answer, provider, studio });
  } catch {
    return json({ error: "حدث خطأ غير متوقع أثناء الاتصال بالمحرك. حاول مرة أخرى." }, 500);
  }
}
