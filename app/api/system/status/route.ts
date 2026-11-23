export const dynamic = "force-dynamic";

type Check = { id: string; label: string; configured: boolean; required: string[]; note: string };

const has = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));
const hasAny = (...names: string[]) => names.some((name) => Boolean(process.env[name]?.trim()));
const provider = (id: string, label: string, key: string, model?: string): Check => ({
  id, label, configured: model ? has(key, model) : has(key),
  required: model ? [key, model] : [key],
  note: "فحص إعدادات فقط؛ لا يؤكد صلاحية المفتاح أو إتاحة النموذج في حساب المزود."
});

export async function GET() {
  const googleKey = hasAny("GOOGLE_AI_API_KEY", "GEMINI_API_KEY");
  const checks: Check[] = [
    { id: "supabase", label: "Supabase للحسابات والبيانات", configured: has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"), required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], note: "لا يثبت وجود الجداول أو نجاح RPC أو سياسات RLS." },
    provider("openai", "OpenAI للنص", "OPENAI_API_KEY", "OPENAI_MODEL"),
    provider("anthropic", "Anthropic Claude", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"),
    { id: "google", label: "Google Gemini للنص", configured: googleKey && has("GEMINI_MODEL"), required: ["GOOGLE_AI_API_KEY أو GEMINI_API_KEY", "GEMINI_MODEL"], note: "يجب أن يكون النموذج متاحاً في مشروع Google AI الخاص بك." },
    provider("mistral", "Mistral", "MISTRAL_API_KEY", "MISTRAL_MODEL"),
    provider("deepseek", "DeepSeek", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL"),
    provider("groq", "Groq", "GROQ_API_KEY", "GROQ_MODEL"),
    provider("xai", "xAI Grok", "XAI_API_KEY", "XAI_MODEL"),
    provider("cohere", "Cohere", "COHERE_API_KEY", "COHERE_MODEL"),
    provider("together", "Together AI", "TOGETHER_API_KEY", "TOGETHER_MODEL"),
    provider("fireworks", "Fireworks AI", "FIREWORKS_API_KEY", "FIREWORKS_MODEL"),
    { id: "openai-image", label: "OpenAI Image", configured: has("OPENAI_API_KEY", "OPENAI_IMAGE_MODEL"), required: ["OPENAI_API_KEY", "OPENAI_IMAGE_MODEL"], note: "الدقة الفعلية تعتمد على النموذج المدعوم." },
    { id: "google-image", label: "Gemini Image", configured: googleKey && has("GEMINI_IMAGE_MODEL"), required: ["GOOGLE_AI_API_KEY أو GEMINI_API_KEY", "GEMINI_IMAGE_MODEL"], note: "فحص إعدادات فقط." },
    provider("stability", "Stability AI", "STABILITY_API_KEY"),
    { id: "fal-image", label: "fal Image", configured: has("FAL_KEY", "FAL_IMAGE_MODEL"), required: ["FAL_KEY", "FAL_IMAGE_MODEL"], note: "يجب أن تكون نقطة النهاية مفعّلة في حساب fal." },
    { id: "runway-video", label: "Runway Video", configured: has("RUNWAY_API_KEY", "RUNWAY_VIDEO_MODEL"), required: ["RUNWAY_API_KEY", "RUNWAY_VIDEO_MODEL"], note: "تأكد من توفر النموذج وصلاحيات الفيديو في الحساب." },
    { id: "kling-video", label: "Kling Video", configured: has("KLING_API_KEY"), required: ["KLING_API_KEY"], note: "يتطلب حساباً وصلاحية API ونموذجاً متاحاً." },
    { id: "luma-video", label: "Luma Video", configured: has("LUMA_API_KEY", "LUMA_VIDEO_MODEL"), required: ["LUMA_API_KEY", "LUMA_VIDEO_MODEL"], note: "فحص إعدادات فقط." },
    { id: "google-video", label: "Gemini Video", configured: googleKey && has("GEMINI_VIDEO_MODEL"), required: ["GOOGLE_AI_API_KEY أو GEMINI_API_KEY", "GEMINI_VIDEO_MODEL"], note: "قد يتطلب النموذج أهلية أو تفعيل مدفوع." },
    { id: "fal-video", label: "fal Video", configured: has("FAL_KEY", "FAL_VIDEO_MODEL"), required: ["FAL_KEY", "FAL_VIDEO_MODEL"], note: "يجب أن تكون نقطة النهاية مفعّلة في حساب fal." },
    { id: "elevenlabs", label: "ElevenLabs TTS", configured: has("ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID", "ELEVENLABS_MODEL"), required: ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID", "ELEVENLABS_MODEL"], note: "تحقق من توفر الصوت والنموذج في الحساب." },
    { id: "google-tts", label: "Gemini TTS", configured: googleKey && has("GEMINI_TTS_MODEL"), required: ["GOOGLE_AI_API_KEY أو GEMINI_API_KEY", "GEMINI_TTS_MODEL"], note: "فحص إعدادات فقط." },
    provider("runway-music", "Runway Music", "RUNWAY_API_KEY", "RUNWAY_MUSIC_MODEL"),
    provider("runway-sfx", "Runway Sound Effects", "RUNWAY_API_KEY", "RUNWAY_SFX_MODEL"),
    provider("deepgram", "Deepgram Transcription", "DEEPGRAM_API_KEY"),
    provider("assemblyai", "AssemblyAI Transcription", "ASSEMBLYAI_API_KEY"),
    { id: "stripe", label: "Stripe Payments", configured: has("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID"), required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID"], note: "لا تفعّل الدفع قبل اختبار Checkout وWebhook وأهلية بلد النشاط." },
    { id: "credits", label: "محفظة النقاط", configured: has("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"), required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], note: "لا يثبت هذا الفحص تطبيق migration أو عمل دوال RPC." }
  ];
  const configured = checks.filter((item) => item.configured).length;
  return Response.json({
    service: "NEXORA AI",
    status: configured === checks.length ? "configured" : "needs_setup",
    summary: { configured, total: checks.length },
    checks,
    verification: "configuration_only",
    checkedAt: new Date().toISOString(),
    security: "لا يعرض هذا المسار أي قيمة سرية ولا يرسل طلبات مدفوعة إلى مزودي الخدمات."
  }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
