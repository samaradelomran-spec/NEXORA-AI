"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AudioLines, Bot, CheckCircle2, Code2, Film, Image as ImageIcon, Search, ShieldCheck, Video } from "lucide-react";

type Category = "all" | "text" | "image" | "video" | "audio";
const engines = [
  { name: "OpenAI", providerId: "openai", category: "text", tasks: "المحادثة، الكتابة، البرمجة والتحليل", detail: "نماذج لغوية ومساعدة ذكية متعددة الاستخدامات", key: "OPENAI_API_KEY" },
  { name: "Anthropic Claude", providerId: "anthropic", category: "text", tasks: "الكتابة الطويلة، التحليل والبرمجة", detail: "مساعد لغوي متقدم لفهم السياق والعمل على المشاريع", key: "ANTHROPIC_API_KEY" },
  { name: "Google Gemini", providerId: "google", category: "text", tasks: "المحادثة، تحليل الصور والملفات", detail: "نماذج متعددة الوسائط ومهام عامة", key: "GOOGLE_AI_API_KEY" },
  { name: "Mistral AI", providerId: "mistral", category: "text", tasks: "المحادثة، التلخيص والبرمجة", detail: "عائلة نماذج لغوية قابلة للاستخدام عبر API", key: "MISTRAL_API_KEY" },
  { name: "OpenAI Images", providerId: "openai", category: "image", tasks: "إنشاء الصور وتحريرها", detail: "توليد صور من الوصف وتعديلات الصور المدعومة", key: "OPENAI_API_KEY" },
  { name: "Google Gemini", providerId: "google", category: "image", tasks: "إنشاء الصور وفهم الصور", detail: "قدرات صور بحسب النموذج والخطة المتاحة", key: "GOOGLE_AI_API_KEY" },
  { name: "Black Forest Labs FLUX", providerId: "fal", category: "image", tasks: "توليد الصور الفنية والواقعية", detail: "نماذج FLUX عبر واجهات المزود المدعومة", key: "FAL_KEY أو BFL_API_KEY" },
  { name: "Stability AI", providerId: "stability", category: "image", tasks: "إنشاء الصور والتحرير والتحسين", detail: "أدوات توليد وتعديل الصور حسب توفر النموذج", key: "STABILITY_API_KEY" },
  { name: "Runway", providerId: "runway", category: "video", tasks: "إنشاء الفيديو والتحرير", detail: "إنتاج فيديو عبر واجهات Runway المتاحة", key: "RUNWAY_API_KEY" },
  { name: "Google Gemini Omni Video", providerId: "google", category: "video", tasks: "توليد فيديو قصير من النص", detail: "إنشاء مقاطع قصيرة عبر Gemini Omni Flash", key: "GOOGLE_AI_API_KEY" },
  { name: "Kling AI", providerId: "catalog", category: "video", tasks: "تحريك الصور وإنشاء المقاطع", detail: "يتطلب وصول API من مزود يدعم حسابك", key: "KLING_API_KEY" },
  { name: "Luma", providerId: "luma", category: "video", tasks: "مشاهد ومقاطع فيديو مولدة", detail: "إنشاء فيديو وفق إمكانات النموذج المتاحة", key: "LUMA_API_KEY" },
  { name: "ElevenLabs", providerId: "elevenlabs", category: "audio", tasks: "الأصوات والتعليق الصوتي", detail: "تحويل النص إلى كلام وأدوات صوتية", key: "ELEVENLABS_API_KEY" },
  { name: "Runway Music", providerId: "runway", category: "audio", tasks: "توليد الموسيقى", detail: "توليد مقاطع موسيقية وآلاتية", key: "RUNWAY_API_KEY" },
  { name: "Runway Sound Effects", providerId: "runway", category: "audio", tasks: "المؤثرات الصوتية", detail: "إنشاء مؤثرات صوتية من وصف نصي", key: "RUNWAY_API_KEY" },
  { name: "Google Gemini TTS", providerId: "google", category: "audio", tasks: "التعليق الصوتي متعدد اللغات", detail: "توليد صوت طبيعي مع التحكم بالنبرة والإلقاء", key: "GOOGLE_AI_API_KEY" },
  { name: "Deepgram", providerId: "catalog", category: "audio", tasks: "تحويل الكلام إلى نص", detail: "تفريغ الصوت والتعرف على الكلام", key: "DEEPGRAM_API_KEY" },
  { name: "OpenAI Audio", providerId: "openai", category: "audio", tasks: "الصوت والتفريغ والمعالجة", detail: "واجهات صوتية بحسب النماذج المتاحة", key: "OPENAI_API_KEY" },
  { name: "AssemblyAI", providerId: "catalog", category: "audio", tasks: "التفريغ والتحليل الصوتي", detail: "واجهات للتعرف على الكلام ومعالجة الصوت", key: "ASSEMBLYAI_API_KEY" },
  { name: "DeepSeek", providerId: "deepseek", category: "text", tasks: "البرمجة، التفكير وحل المشكلات", detail: "نموذج لغوي متخصص؛ يحتاج إضافة موصل API واختباره قبل تفعيله", key: "DEEPSEEK_API_KEY" },
  { name: "Groq", providerId: "groq", category: "text", tasks: "البرمجة والاستجابة السريعة", detail: "استضافة استدلال سريعة؛ يحتاج إضافة موصل API واختباره", key: "GROQ_API_KEY" },
  { name: "xAI Grok", providerId: "xai", category: "text", tasks: "التحليل والكتابة والبرمجة", detail: "نماذج Grok عبر API؛ يحتاج إضافة موصل API واختباره", key: "XAI_API_KEY" },
  { name: "Cohere", providerId: "cohere", category: "text", tasks: "البحث الدلالي وتحليل النصوص", detail: "نماذج اللغة والاسترجاع؛ يحتاج إضافة موصل API واختباره", key: "COHERE_API_KEY" },
  { name: "Together AI", providerId: "together", category: "text", tasks: "نماذج مفتوحة للبرمجة والتوليد", detail: "منصة نماذج متعددة؛ يحتاج تحديد النماذج وإضافة الموصل", key: "TOGETHER_API_KEY" },
  { name: "Fireworks AI", providerId: "fireworks", category: "text", tasks: "البرمجة والاستدلال متعدد النماذج", detail: "استضافة نماذج مفتوحة؛ يحتاج إضافة موصل API واختباره", key: "FIREWORKS_API_KEY" }
] as const;

const categories: { id: Category; label: string; icon: typeof Bot }[] = [
  { id: "all", label: "كل المحركات", icon: Bot },
  { id: "text", label: "النص والبرمجة", icon: Code2 },
  { id: "image", label: "الصور", icon: ImageIcon },
  { id: "video", label: "الفيديو والسينما", icon: Video },
  { id: "audio", label: "الصوت", icon: AudioLines }
];

export default function ModelDirectory() {
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [configured, setConfigured] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetch("/api/system/status", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      const next: Record<string, boolean> = {};
      for (const provider of data.providers || []) next[provider.id] = Boolean(provider.configured);
      setConfigured(next);
    }).catch(() => setConfigured({}));
  }, []);
  const visible = useMemo(() => engines.filter((engine) =>
    (category === "all" || engine.category === category) &&
    (engine.name.toLowerCase().includes(query.toLowerCase()) || engine.tasks.includes(query))
  ), [category, query]);

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">منظومة الذكاء الاصطناعي</span><h1>مكتبة المحركات</h1><p>25 محركاً موزعاً على النص والبرمجة والصور والفيديو والصوت؛ حالة كل موصل موضحة بشفافية.</p></div><span className="portal-heading-icon"><Bot size={25} /></span></div>
      <div className="engine-notice"><ShieldCheck size={19} /><div><b>حالة الربط بشفافية</b><p>تتحدث حالة المفتاح تلقائياً من إعدادات الخادم. وجود المفتاح لا يثبت نجاح الاتصال؛ لن نعرض محركاً على أنه يعمل قبل اختبار طلب حقيقي.</p></div></div>
      <div className="engine-stats"><div><strong>{engines.length}</strong><span>محركاً ضمن الخطة</span></div><div><strong>4</strong><span>مجالات رئيسية</span></div><div><strong>2K / 4K</strong><span>حسب دعم كل نموذج</span></div></div>
      <div className="engine-tools"><div className="engine-tabs">{categories.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setCategory(item.id)} className={category === item.id ? "engine-tab active" : "engine-tab"}><Icon size={15} />{item.label}</button>; })}</div><label className="engine-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن محرك..." /></label></div>
      <div className="engine-grid">{visible.map((engine) => <article className="engine-card" key={engine.name + engine.category}><div className="engine-card-top"><span className="engine-avatar">{engine.category === "text" ? <Bot size={20} /> : engine.category === "image" ? <ImageIcon size={20} /> : engine.category === "video" ? <Film size={20} /> : <AudioLines size={20} />}</span><span className={configured[engine.providerId] ? "engine-status engine-configured" : "engine-status"}><i />{configured[engine.providerId] ? "المفتاح موجود · يحتاج اختبار" : "غير مربوط"}</span></div><h2>{engine.name}</h2><b className="engine-task">{engine.tasks}</b><p>{engine.detail}</p><div className="engine-key">متغير الربط: <code>{engine.key}</code></div></article>)}</div>
      {visible.length === 0 && <p className="engine-empty">ما لقينا محركاً مطابقاً لبحثك.</p>}
      <div className="engine-foot"><CheckCircle2 size={17} /><span>بعد إضافة مفاتيح المزودين إلى إعدادات الاستضافة، سنختبر الاتصال ونحدّث حالة كل محرك.</span></div>
    </section>
  </main>;
}
