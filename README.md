# NEXORA AI

منصة عربية موحدة للإبداع والإنتاج باستخدام الذكاء الاصطناعي، بواجهة RTL متجاوبة.

## الاستوديوهات والصفحات
- المواقع والتطبيقات، الألعاب، الصور، الفيديو والسينما، المسلسلات، الصوت، والمساعد الذكي.
- مكتبة محركات، المشاريع، سجل العمليات، التخزين السحابي، الخطط، الإعدادات، ولوحة الإدارة.

## التقنيات
- Next.js 15، React 19، TypeScript.
- Supabase Auth وPostgres وStorage.
- واجهات API server-side للمحركات؛ مفاتيح المزودين لا تُرسل إلى المتصفح.

## تكاملات API الموجودة في الكود
- النص والمساعد: OpenAI Responses API، Anthropic Messages API، Google Gemini Interactions API، وMistral Chat Completions API.
- الصور: OpenAI Images API وGoogle Gemini 3.1 Flash Image وStability AI Stable Image وFLUX 2 Pro عبر fal.ai، مع أهداف 1K/2K/4K بحسب إمكانات النموذج.
- الفيديو: fal.ai Queue API وRunway Dev Tasks API وRunway Music وSound Effects API، مع تحديد نقطة النهاية والنموذج عبر متغيرات البيئة.
- الصوت: ElevenLabs Text-to-Speech وGoogle Gemini TTS.
- الدفع: Stripe Checkout للاشتراك، Stripe Billing Portal، وWebhook موثّق لتحديث جدول الاشتراكات.

**مهم:** وجود الكود لا يعني أن الخدمة متصلة. كل محرك يحتاج مفتاح API صالحاً، وقد يحتاج نموذجاً أو نقطة نهاية مفعّلة في حساب المزود. لم يتم نشر الموقع بعد، ولم يتم اختبار هذه الاتصالات بمفاتيح حقيقية.

## إعداد البيئة

انسخ `.env.example` إلى ملف البيئة الخاص بالاستضافة، ثم أضف القيم السرية في إعدادات الخادم فقط.

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — للخادم ولوحة الإدارة فقط؛ لا تضعه في متغير يبدأ بـ `NEXT_PUBLIC_`.

### الذكاء الاصطناعي
- `OPENAI_API_KEY` و`OPENAI_IMAGE_MODEL`
- `STABILITY_API_KEY` و`STABILITY_IMAGE_ENDPOINT`
- `ANTHROPIC_API_KEY` و`ANTHROPIC_MODEL`
- `GOOGLE_AI_API_KEY` و`GEMINI_MODEL` و`GEMINI_IMAGE_MODEL` و`GEMINI_VIDEO_MODEL`
- `FAL_KEY` و`FAL_IMAGE_MODEL` و`FAL_VIDEO_MODEL` و`FAL_VIDEO_RESOLUTION_FIELD` و`FAL_VIDEO_DURATION_FIELD` و`FAL_VIDEO_DEFAULT_PARAMS`
- `RUNWAY_API_KEY` و`RUNWAY_VIDEO_MODEL`
- `LUMA_API_KEY` و`LUMA_VIDEO_MODEL` و`RUNWAY_MUSIC_MODEL` و`RUNWAY_SFX_MODEL`
- `ELEVENLABS_API_KEY` و`ELEVENLABS_DEFAULT_VOICE_ID` و`ELEVENLABS_MODEL`
- `GEMINI_TTS_MODEL` و`GEMINI_TTS_VOICE` (مع مفتاح Google)

### الإدارة
- `NEXORA_ADMIN_EMAILS` — قائمة عناوين البريد المسموح لها بلوحة الإدارة، مفصولة بفواصل.
- مفتاح `SUPABASE_SERVICE_ROLE_KEY` يبقى على الخادم فقط.

### الدفع
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID` — معرّف سعر شهري بقيمة 15 USD يُنشأ في حساب Stripe.
- نقطة استقبال Webhook: `/api/payments/webhook`.
- الأحداث المطلوبة: `customer.subscription.created` و`customer.subscription.updated` و`customer.subscription.deleted`.

بوابة الدفع لا تصبح جاهزة إلا بعد التأكد من أن Stripe يدعم بلد تسجيل النشاط التجاري، وإنشاء السعر، وإعداد Webhook، ثم إتمام عملية اختبار كاملة.

## ملفات SQL الإضافية
بعد مراجعة الملفات، شغّلها مرة واحدة في Supabase SQL Editor:
- `supabase/migrations/20261122_nexora_storage.sql` — ينشئ bucket خاصاً باسم `nexora-files` وسياسات وصول لكل مستخدم.
- `supabase/migrations/20261122_generation_jobs_update.sql` — يسمح لصاحب المهمة بتحديث حالتها ونتيجتها.
- `supabase/migrations/20261122_usage_limits.sql` — يضيف حدود الاستخدام اليومية الافتراضية للخطة المجانية وPro.

لا تُشغّل ملفات SQL قبل مراجعتها والتأكد من عدم وجود سياسات بنفس الأسماء.

## التشغيل المحلي
```bash
npm install
npm run dev
```

## الدقة والجودة
تُعرض 2K و4K كدقة مستهدفة فقط عندما يدعمها المحرك ونقطة النهاية. دقة 4K في الصور قد تكون تجريبية لدى المزود؛ ولا نضمن دقة أصلية موحدة لكل المحركات.

## حالة الإطلاق
المشروع ما زال في مرحلة التطوير. يلزم إكمال إعداد Supabase وStorage ومفاتيح المحركات والدفع، ثم اختبار الحسابات والتوليد والاشتراكات قبل نشر الموقع. توجد حدود استخدام يومية ابتدائية تختلف حسب نوع الخدمة والخطة، ويمكن تعديلها من جدول `plan_limits` بعد مراجعة تكلفة مزودي النماذج.
