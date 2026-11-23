# NEXORA AI

منصة عربية موحدة للإبداع والإنتاج باستخدام الذكاء الاصطناعي، بواجهة RTL متجاوبة.

## الاستوديوهات والصفحات
- عشرة استوديوهات تخصصية، مع 25 مدخلاً في دليل المحركات. هذه المداخل لا تعني 25 مزود API مستقلاً؛ قد تستخدم عدة مداخل المزود نفسه.
- مكتبة محركات، المشاريع، سجل العمليات، التخزين السحابي، الخطط، الإعدادات، ولوحة الإدارة.

## التقنيات
- Next.js 15، React 19، TypeScript.
- Supabase Auth وPostgres وStorage.
- واجهات API server-side للمحركات؛ مفاتيح المزودين لا تُرسل إلى المتصفح.

## تكاملات API الموجودة في الكود
- النص والمساعد: OpenAI Responses API، Anthropic Messages API، Google Gemini Interactions API، Mistral، DeepSeek، Groq، xAI، Cohere، Together AI، وFireworks AI.
- الصور: OpenAI Images API وGoogle Gemini وStability AI Stable Image وFLUX عبر fal.ai. يجب تحديد معرّف نموذج الصورة المتاح في حساب المزود.
- الفيديو: fal.ai Queue API وRunway Dev Tasks API وLuma Dream Machine API وGoogle Gemini وKling. يتطلب كل مزود معرّف نموذج متاحاً في الحساب؛ لا نضمن دقة 2K/4K إلا عندما يدعمها النموذج ونقطة النهاية.
- الصوت: ElevenLabs Text-to-Speech وGoogle Gemini TTS وRunway Music وSound Effects، إضافة إلى Deepgram وAssemblyAI للتفريغ الصوتي.
- الدفع: Stripe Checkout للاشتراك، Stripe Billing Portal، وWebhook موثّق لتحديث جدول الاشتراكات.

**مهم:** وجود الكود لا يعني أن الخدمة متصلة. كل محرك يحتاج مفتاح API صالحاً، وقد يحتاج نموذجاً أو نقطة نهاية مفعّلة في حساب المزود. لم يتم نشر الموقع بعد، ولم يتم اختبار هذه الاتصالات بمفاتيح حقيقية.

## إعداد البيئة

انسخ `.env.example` إلى ملف البيئة الخاص بالاستضافة، ثم أضف القيم السرية في إعدادات الخادم فقط.

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — للخادم ولوحة الإدارة فقط؛ لا تضعه في متغير يبدأ بـ `NEXT_PUBLIC_`.

### الذكاء الاصطناعي
- `OPENAI_API_KEY` و`OPENAI_MODEL` و`OPENAI_IMAGE_MODEL`
- `STABILITY_API_KEY` و`STABILITY_IMAGE_ENDPOINT`
- `ANTHROPIC_API_KEY` و`ANTHROPIC_MODEL`
- `MISTRAL_API_KEY` و`MISTRAL_MODEL`
- `GOOGLE_AI_API_KEY` و`GEMINI_MODEL` و`GEMINI_IMAGE_MODEL` و`GEMINI_VIDEO_MODEL` و`GEMINI_TTS_MODEL`
- `FAL_KEY` و`FAL_IMAGE_MODEL` و`FAL_VIDEO_MODEL` و`FAL_VIDEO_RESOLUTION_FIELD` و`FAL_VIDEO_DURATION_FIELD` و`FAL_VIDEO_DEFAULT_PARAMS`
- `RUNWAY_API_KEY` و`RUNWAY_VIDEO_MODEL` و`RUNWAY_MUSIC_MODEL` و`RUNWAY_SFX_MODEL`
- `LUMA_API_KEY` و`LUMA_VIDEO_MODEL`
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
- `supabase/migrations/20261122_credits_ledger.sql` — ينشئ محفظة النقاط وسجل الحركات ودوال الخصم والإعادة.

لا تُشغّل ملفات SQL قبل مراجعتها والتأكد من عدم وجود سياسات بنفس الأسماء.

## التشغيل المحلي
```bash
npm install
npm run dev
```

## محفظة النقاط

يخصم الخادم النقاط بعد نجاح التوليد، ويتحقق من الرصيد قبل استدعاء المزود. تُعاد النقاط تلقائياً عند فشل مهام الفيديو والموسيقى والتفريغ غير المتزامنة. الأسعار الحالية بالنقاط: المساعد/البرمجة/الألعاب 45، الصورة 110، الفيديو 155، الصوت/الموسيقى/المؤثرات/التفريغ 130، الموقع 660، التطبيق 570، البرمجيات 880، السينما 1,320، المسلسل 3,080، والمسلسل 4K 4,400. يتجاوز حساب الإدارة الخصم إذا كان بريده موجوداً في NEXORA_ADMIN_EMAILS. يلزم إعداد SUPABASE_SERVICE_ROLE_KEY وتطبيق ترحيل محفظة النقاط.

## الدقة والجودة
لا تتطلب دقة 2K و4K خطة NEXORA Pro؛ تُعرض كدقة مستهدفة فقط عندما يدعمها المحرك ونقطة النهاية وحساب المزود. خطة Pro تضيف تحسينات وصفية للواقعية السينمائية والتفاصيل في الصور والفيديو. رسوم مزودي المحركات الخارجية مستقلة عن اشتراك NEXORA. دقة 4K في الصور قد تكون تجريبية لدى المزود؛ ولا نضمن دقة أصلية موحدة لكل المحركات.

## حالة الإطلاق
المشروع ما زال في مرحلة التطوير. يلزم إكمال إعداد Supabase وStorage ومفاتيح المحركات والدفع، ثم اختبار الحسابات والتوليد والاشتراكات قبل نشر الموقع. توجد حدود استخدام يومية ابتدائية تختلف حسب نوع الخدمة والخطة، ويمكن تعديلها من جدول `plan_limits` بعد مراجعة تكلفة مزودي النماذج.


## معاينة ما قبل النشر

- يُنشأ رابط معاينة مستقل عند ربط المستودع باستضافة تدعم Preview Deployments، مثل Vercel، ثم فتح Pull Request من فرع غير فرع الإنتاج.
- المعاينة مخصصة لمراجعة الواجهة والتنقل والتجاوب قبل النشر، ولا تنشر التغييرات على نطاق الإنتاج.
- يمكن فتح الواجهة حتى قبل إضافة مفاتيح الخدمات؛ ستظهر الخدمات غير المهيأة على أنها بانتظار الربط، ولن تعمل عمليات التوليد أو الحسابات أو الدفع حتى إضافة متغيرات البيئة المطلوبة.
- لا تدمج هذا الفرع في `main` قبل اعتماد المعاينة وإتمام اختبار الخدمات الفعلية.


## تشغيل إنتاجي باستخدام Docker

يتضمن المستودع صورة إنتاجية متعددة المراحل مبنية على Next.js Standalone، ويمكن تشغيلها على أي استضافة تدعم Docker.

```bash
docker build -t nexora-ai .
docker run --env-file .env -p 3000:3000 nexora-ai
```

- نقطة فحص صحة الحاوية: `/api/health`.
- يقرأ التطبيق مفاتيح Supabase ومزودي الذكاء الاصطناعي من متغيرات بيئة الخادم.
- لا تضع ملف `.env` داخل المستودع أو صورة Docker؛ أضف الأسرار من لوحة الاستضافة.
- بناء الصورة لا ينشئ حساب استضافة أو عنواناً عاماً تلقائياً؛ يجب تشغيل الحاوية لدى مزود استضافة.



## فحص جاهزية الإعدادات

بعد تشغيل التطبيق، افتح `/api/system/status` لعرض الخدمات التي لديها مفاتيح إعداد موجودة. هذا الفحص لا يكشف الأسرار ولا ينفذ طلبات مدفوعة، لكنه **ليس اختبار اتصال حياً** ولا يثبت صلاحية المفاتيح أو تفعيل النماذج أو تطبيق SQL. يجب تنفيذ اختبار توليد فعلي لكل مزود، واختبار تسجيل الدخول والتخزين وعمليات الدفع في بيئة اختبار قبل إطلاق الموقع.

حالة `configured` تعني أن متغيرات البيئة المطلوبة موجودة فقط. لا تعني أن التكامل يعمل أو أن حساب المزود لديه رصيد أو صلاحية. لا يمكن إجراء اختبار توليد حي حتى تُضاف مفاتيح API الحقيقية ومعرّفات النماذج من حسابات المالك في إعدادات الأسرار الخاصة بالاستضافة. لا تضع مفاتيح API داخل Git أو ترسلها في المحادثات.
