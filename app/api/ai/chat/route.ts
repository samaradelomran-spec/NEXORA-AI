import { checkDailyGenerationLimit } from ""../../../../lib/server/generation-jobs"";
import { ensureCreditBalance, chargeCredits, refundCredits, studioCreditCost, CREDIT_COSTS } from "../../../../lib/server/credits";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Provider = "openai" | "anthropic" | "google" | "mistral" | "deepseek" | "groq" | "xai" | "cohere" | "together" | "fireworks";

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
  const user = await response.json() as { id: string; email?: string };
  return { ...user, token, url, anon };
}

async function recordJob(user: { id: string; token: string; url: string; anon: string }, serviceType: string, prompt: string, result: Record<string, unknown>) {
  try {
    await fetch(user.url + "/rest/v1/generation_jobs", {
      method: "POST",
      headers: { apikey: user.anon, Authorization: "Bearer " + user.token, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ owner_id: user.id, service_type: serviceType, prompt, status: "completed", result }),
      cache: "no-store"
    });
  } catch {
    // Generation output remains available if optional history logging fails.
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
    const studio = ["coding", "software", "web", "games", "cinema", "series"].includes(body.studio || "") ? body.studio! : "assistant";
    if (!["openai", "anthropic", "google", "mistral", "deepseek", "groq", "xai", "cohere", "together", "fireworks"].includes(String(provider))) {
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
    const usage = await checkDailyGenerationLimit({ url: user.url, anon: user.anon, token: user.token, ownerId: user.id, serviceType: studio });
    if (!usage.allowed) return json({ error: usage.reason === "limit" ? "وصلت إلى حدك اليومي (" + usage.limit + " عملية). جرّب غداً أو انتقل إلى Pro." : "تعذر التحقق من حد الاستخدام. حاول بعد قليل." }, usage.reason === "limit" ? 429 : 503);
    const creditAmount = studioCreditCost(studio);
    const creditCheck = await ensureCreditBalance({ url: user.url, ownerId: user.id, email: user.email, amount: creditAmount });
    if (!creditCheck.ok) return json({ error: creditCheck.error }, creditCheck.status);

    const studioInstructions: Record<string, string> = {
      coding: "أنت مهندس برمجيات خبير في NEXORA AI. اكتب كوداً عملياً واضحاً، اقترح بنية ملفات، نفّذ الحل خطوة بخطوة، أضف اختبارات وأوامر تشغيل، واذكر أي افتراضات. لا تدّع تشغيل الكود أو نشره ما لم يحدث فعلياً.",
      software: "أنت مهندس إنشاء أنظمة وبرامج في NEXORA AI. صمّم المنتج كبرنامج متكامل: المتطلبات، المعمارية، الواجهات، قاعدة البيانات، واجهات API، الأمان، التثبيت والتوزيع. افصل تصميم النظام عن كتابة الكود، وقدّم ملفات وأوامر قابلة للتنفيذ دون ادعاء بناء ملف تنفيذي لم يتم إنشاؤه.",
      assistant: "أنت مساعد NEXORA AI. أجب بدقة ووضوح، وبلغة المستخدم، ولا تدّع تنفيذ إجراءات أو إنشاء ملفات لم تنفذها فعلياً.",
      web: "أنت مهندس تجربة مستخدم ومطور مواقع وتطبيقات في NEXORA AI. أنشئ خطة تنفيذ واضحة ثم أمثلة كود عملية قابلة للتشغيل، مع هيكل الملفات وتعليمات التشغيل. اسأل فقط إذا كانت معلومة أساسية ناقصة. لا تدّع أنك نشرت الموقع.",
      games: "أنت مصمم ألعاب ومهندس تطوير ألعاب في NEXORA AI. أنشئ وثيقة تصميم لعبة تشمل الفكرة والميكانيكيات والمراحل والشخصيات وواجهة اللعب، وأضف نموذج كود أولي عند الحاجة. لا تدّع أنك بنيت ملف لعبة جاهزاً ما لم تفعل ذلك.",
      cinema: "أنت كاتب سيناريو ومخرج سينمائي في NEXORA AI. طوّر الفكرة إلى معالجة سينمائية ومشاهد وحوار ووصف لقطات وحركة كاميرا وصوت وإضاءة، مع الحفاظ على طلب المستخدم.",
      series: "أنت كاتب مسلسلات في NEXORA AI. ابنِ عالم المسلسل والشخصيات وأقواسها وخريطة الحلقات ثم اكتب المشاهد والحوار بالتفصيل وفق طلب المستخدم."
    };
    const systemInstruction = studioInstructions[studio];
    let response: Response;
    let answer = "";

    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key || !process.env.OPENAI_MODEL?.trim()) return json({ error: "أضف OPENAI_API_KEY وOPENAI_MODEL من حسابك في إعدادات الخادم." }, 503);
      const input = safeMessages.map((item) => ({ role: item.role, content: item.content }));
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL, instructions: systemInstruction, input, max_output_tokens: 1800 }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على OpenAI إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      answer = extractOpenAI(data);
    } else if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key || !process.env.ANTHROPIC_MODEL?.trim()) return json({ error: "أضف ANTHROPIC_API_KEY وANTHROPIC_MODEL من حسابك في إعدادات الخادم." }, 503);
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL,
          system: systemInstruction,
          messages: safeMessages.map((item) => ({ role: item.role, content: item.content })),
          max_tokens: 1800
        }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على Claude إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      answer = (data.content || []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
    } else if (provider === "mistral") {
      const key = process.env.MISTRAL_API_KEY;
      if (!key || !process.env.MISTRAL_MODEL?.trim()) return json({ error: "أضف MISTRAL_API_KEY وMISTRAL_MODEL من حسابك في إعدادات الخادم." }, 503);
      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.MISTRAL_MODEL,
          messages: [{ role: "system", content: systemInstruction }, ...safeMessages],
          max_tokens: 1800
        }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على Mistral إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      const content = data.choices?.[0]?.message?.content;
      answer = typeof content === "string" ? content : Array.isArray(content) ? content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n") : "";
    } else if (provider === "deepseek" || provider === "groq" || provider === "xai" || provider === "together" || provider === "fireworks") {
      const configs = {
        deepseek: { key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL, url: "https://api.deepseek.com/chat/completions", label: "DeepSeek" },
        groq: { key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL, url: "https://api.groq.com/openai/v1/chat/completions", label: "Groq" },
        xai: { key: process.env.XAI_API_KEY, model: process.env.XAI_MODEL, url: "https://api.x.ai/v1/chat/completions", label: "xAI Grok" },
        together: { key: process.env.TOGETHER_API_KEY, model: process.env.TOGETHER_MODEL, url: "https://api.together.xyz/v1/chat/completions", label: "Together AI" },
        fireworks: { key: process.env.FIREWORKS_API_KEY, model: process.env.FIREWORKS_MODEL, url: "https://api.fireworks.ai/inference/v1/chat/completions", label: "Fireworks AI" }
      } as const;
      const config = configs[provider];
      if (!config.key) return json({ error: config.label + " غير مربوط بعد. أضف مفتاح API في إعدادات الخادم." }, 503);
      if (!config.model?.trim()) return json({ error: "أضف معرّف النموذج المتاح في حساب " + config.label + " إلى متغير " + provider.toUpperCase() + "_MODEL." }, 503);
      response = await fetch(config.url, {
        method: "POST",
        headers: { Authorization: "Bearer " + config.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "system", content: systemInstruction }, ...safeMessages],
          max_tokens: 1800
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(80000)
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على " + config.label + " إكمال الطلب. تحقق من المفتاح ومعرّف النموذج والرصيد." }, 502);
      const content = data.choices?.[0]?.message?.content;
      answer = typeof content === "string" ? content : Array.isArray(content) ? content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n") : "";
    } else if (provider === "cohere") {
      const key = process.env.COHERE_API_KEY;
      const model = process.env.COHERE_MODEL;
      if (!key) return json({ error: "Cohere غير مربوط بعد. أضف COHERE_API_KEY في إعدادات الخادم." }, 503);
      if (!model?.trim()) return json({ error: "أضف معرّف النموذج المتاح في حساب Cohere إلى COHERE_MODEL." }, 503);
      response = await fetch("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemInstruction }, ...safeMessages],
          max_tokens: 1800
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(80000)
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على Cohere إكمال الطلب. تحقق من المفتاح ومعرّف النموذج والرصيد." }, 502);
      answer = (data.message?.content || []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
    } else {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!key || !process.env.GEMINI_MODEL?.trim()) return json({ error: "أضف GOOGLE_AI_API_KEY وGEMINI_MODEL من حسابك في إعدادات الخادم." }, 503);
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.GEMINI_MODEL,
          store: false,
          input: safeMessages.map((item, index) => ({
            type: item.role === "assistant" ? "model_output" : "user_input",
            content: [{ type: "text", text: index === 0 && item.role === "user" ? systemInstruction + "\n\n" + item.content : item.content }]
          }))
        }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) return json({ error: "تعذر على Gemini إكمال الطلب. تحقق من المفتاح وصلاحيات النموذج." }, 502);
      answer = extractGoogle(data);
    }

    if (!answer.trim()) return json({ error: "عاد المحرك برد فارغ. جرّب مرة أخرى." }, 502);
    const charge = await chargeCredits({ url: user.url, ownerId: user.id, email: user.email, amount: creditAmount, description: "استخدام محرك " + studio, metadata: { provider, studio } });
    if (!charge.ok) return json({ error: charge.error }, charge.status);
    await recordJob(user, studio, safeMessages[safeMessages.length - 1].content, { provider });
    return json({ answer, provider, studio });
  } catch {
    return json({ error: "حدث خطأ غير متوقع أثناء الاتصال بالمحرك. حاول مرة أخرى." }, 500);
  }
}
