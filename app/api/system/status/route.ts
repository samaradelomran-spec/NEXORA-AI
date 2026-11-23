export const dynamic = "force-dynamic";

type Check = {
  id: string;
  label: string;
  configured: boolean;
  required: string[];
  note: string;
};

const has = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));
const hasAny = (...names: string[]) => names.some((name) => Boolean(process.env[name]?.trim()));

export async function GET() {
  const checks: Check[] = [
    { id: "supabase", label: "Supabase للحسابات والبيانات", configured: has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"), required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], note: "وجود المفاتيح لا يثبت تطبيق migrations أو سياسات RLS أو Storage؛ اختبر تسجيل الدخول والرفع فعلياً." },
    { id: "openai", label: "OpenAI للنص", configured: has("OPENAI_API_KEY", "OPENAI_MODEL"), required: ["OPENAI_API_KEY", "OPENAI_MODEL"], note: "يجب أن يكون النموذج المحدد متاحاً في حساب API." },
    { id: "anthropic", label: "Anthropic Claude", configured: has("ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"), required: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"], note: "يجب أن يكون النموذج المحدد متاحاً في حساب Anthropic." },
    { id: "google", label: "Google Gemini", configured: hasAny("GOOGLE_AI_API_KEY", "GEMINI_API_KEY"), required: ["GOOGLE_AI_API_KEY أو GEMINI_API_KEY"], note: "هذا فحص وجود مفتاح فقط، وليس اختباراً لطلب توليد فعلي." },
    { id: "mistral", label: "Mistral", configured: has("MISTRAL_API_KEY", "MISTRAL_MODEL"), required: ["MISTRAL_API_KEY", "MISTRAL_MODEL"], note: "يجب أن يكون النموذج المحدد متاحاً في حسابك." },
    { id: "images", label: "إنشاء الصور", configured: has("OPENAI_API_KEY", "OPENAI_IMAGE_MODEL") || hasAny("GOOGLE_AI_API_KEY", "GEMINI_API_KEY") || has("FAL_KEY", "FAL_IMAGE_MODEL") || has("STABILITY_API_KEY"), required: ["واحد على الأقل من OpenAI أو Gemini أو fal أو Stability"], note: "الدقة والخصائص تختلف حسب النموذج ونقطة النهاية." },
    { id: "video", label: "إنشاء الفيديو", configured: has("RUNWAY_API_KEY", "RUNWAY_VIDEO_MODEL") || has("FAL_KEY", "FAL_VIDEO_MODEL") || has("LUMA_API_KEY", "LUMA_VIDEO_MODEL") || (hasAny("GOOGLE_AI_API_KEY", "GEMINI_API_KEY") && has("GEMINI_VIDEO_MODEL")), required: ["واحد على الأقل من Runway أو fal أو Luma أو Gemini مع إعداد النموذج"], note: "تحقق من صلاحية نقطة النهاية والرصيد والقيود لدى المزود." },
    { id: "audio", label: "تحويل النص إلى صوت", configured: has("ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID") || hasAny("GOOGLE_AI_API_KEY", "GEMINI_API_KEY"), required: ["ElevenLabs مع Voice ID أو مفتاح Gemini"], note: "توفر الصوت واللغة والنموذج يعتمد على المزود." },
    { id: "music", label: "الموسيقى والمؤثرات", configured: has("RUNWAY_API_KEY"), required: ["RUNWAY_API_KEY"], note: "يلزم أيضاً تفعيل نماذج الموسيقى والمؤثرات في حساب Runway." },
    { id: "stripe", label: "اشتراكات Stripe", configured: has("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID"), required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_PRICE_ID"], note: "لا تستقبل مدفوعات حقيقية قبل اختبار Checkout وWebhook والتأكد من أهلية بلد النشاط." },
    { id: "credits", label: "محفظة النقاط", configured: has("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"), required: ["مفاتيح Supabase وتطبيق migration الخاصة بالنقاط"], note: "هذا الفحص لا يتحقق من تطبيق migration أو عمل RPC؛ اختبرهما قبل تفعيل البيع والخصم." }
  ];

  const providers = [
    { id: "openai", configured: has("OPENAI_API_KEY"), integrated: true },
    { id: "anthropic", configured: has("ANTHROPIC_API_KEY"), integrated: true },
    { id: "google", configured: hasAny("GOOGLE_AI_API_KEY", "GEMINI_API_KEY"), integrated: true },
    { id: "mistral", configured: has("MISTRAL_API_KEY"), integrated: true },
    { id: "fal", configured: has("FAL_KEY"), integrated: true },
    { id: "stability", configured: has("STABILITY_API_KEY"), integrated: true },
    { id: "runway", configured: has("RUNWAY_API_KEY"), integrated: true },
    { id: "luma", configured: has("LUMA_API_KEY"), integrated: true },
    { id: "elevenlabs", configured: has("ELEVENLABS_API_KEY"), integrated: true },
    { id: "kling", configured: has("KLING_API_KEY"), integrated: true },
    { id: "deepseek", configured: has("DEEPSEEK_API_KEY", "DEEPSEEK_MODEL"), integrated: true },
    { id: "groq", configured: has("GROQ_API_KEY", "GROQ_MODEL"), integrated: true },
    { id: "xai", configured: has("XAI_API_KEY", "XAI_MODEL"), integrated: true },
    { id: "cohere", configured: has("COHERE_API_KEY", "COHERE_MODEL"), integrated: true },
    { id: "together", configured: has("TOGETHER_API_KEY", "TOGETHER_MODEL"), integrated: true },
    { id: "fireworks", configured: has("FIREWORKS_API_KEY", "FIREWORKS_MODEL"), integrated: true },
    { id: "catalog", configured: false, integrated: false }
  ];
  const configuredCount = checks.filter((item) => item.configured).length;
  return Response.json({
    service: "NEXORA AI",
    status: configuredCount === checks.length ? "configured" : "needs_setup",
    summary: { configured: configuredCount, total: checks.length },
    checks,
    providers,
    verification: "configuration_only",
    checkedAt: new Date().toISOString(),
    security: "لا يعرض هذا المسار أي قيمة سرية ولا يرسل طلبات مدفوعة إلى مزودي الخدمات."
  }, {
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" }
  });
}
