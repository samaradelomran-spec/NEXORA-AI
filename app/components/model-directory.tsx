"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AudioLines, Bot, CheckCircle2, Clapperboard, Code2, Film, Gamepad2, Image as ImageIcon, Layers3, Search, ShieldCheck, Video } from "lucide-react";

type Category = "all" | "coding" | "software" | "webapps" | "games" | "cinema" | "series" | "video" | "image" | "audio" | "assistant";
const engines = [
  { name: "OpenAI Codex", providerId: "openai", category: "coding", tasks: "كتابة الكود وتصحيح الأخطاء والاختبارات", detail: "محرك برمجة مخصص لمهام التطوير", key: "OPENAI_API_KEY" },
  { name: "Claude Code", providerId: "anthropic", category: "coding", tasks: "تحليل قواعد الكود وبناء الميزات", detail: "مساعد هندسي للمهام البرمجية متعددة الملفات", key: "ANTHROPIC_API_KEY" },
  { name: "DeepSeek Coder", providerId: "deepseek", category: "coding", tasks: "حل المسائل وكتابة الكود", detail: "موصل DeepSeek للمحادثة البرمجية؛ يتطلب مفتاحاً ومعرّف نموذج", key: "DEEPSEEK_API_KEY + DEEPSEEK_MODEL" },
  { name: "Groq Code", providerId: "groq", category: "coding", tasks: "توليد الكود والاستجابة السريعة", detail: "موصل Groq للمحادثة البرمجية؛ يتطلب مفتاحاً ومعرّف نموذج", key: "GROQ_API_KEY + GROQ_MODEL" },

  { name: "OpenAI Software Architect", providerId: "openai", category: "software", tasks: "تصميم معمارية البرامج والأنظمة", detail: "تحليل المتطلبات والواجهات وقواعد البيانات والأمان", key: "OPENAI_API_KEY" },
  { name: "Claude Systems Engineer", providerId: "anthropic", category: "software", tasks: "هندسة الأنظمة وتخطيط التنفيذ", detail: "تفكيك النظام إلى خدمات ومكوّنات وخطوات تنفيذ", key: "ANTHROPIC_API_KEY" },
  { name: "Gemini Software Builder", providerId: "google", category: "software", tasks: "تخطيط البرامج متعددة الوسائط", detail: "تصميم حلول البرامج وربط الملفات والوسائط", key: "GOOGLE_AI_API_KEY" },

  { name: "OpenAI Web & App Designer", providerId: "openai", category: "webapps", tasks: "تصميم المواقع وتطبيقات الويب", detail: "تخطيط الصفحات وتجربة المستخدم والواجهات", key: "OPENAI_API_KEY" },
  { name: "Claude Web & App Builder", providerId: "anthropic", category: "webapps", tasks: "بناء هيكل المواقع والتطبيقات", detail: "تحويل المتطلبات إلى مكوّنات وخدمات وخطة تنفيذ", key: "ANTHROPIC_API_KEY" },
  { name: "Gemini UI/UX Builder", providerId: "google", category: "webapps", tasks: "تجربة المستخدم وتحليل المراجع", detail: "تصميم تدفقات الاستخدام والواجهات بمساعدة الوسائط", key: "GOOGLE_AI_API_KEY" },

  { name: "OpenAI Game Developer", providerId: "openai", category: "games", tasks: "تصميم ميكانيكيات اللعبة والكود", detail: "تطوير الفكرة والأنظمة والمراحل والنماذج الأولية", key: "OPENAI_API_KEY" },
  { name: "Claude Game Designer", providerId: "anthropic", category: "games", tasks: "عالم اللعبة والشخصيات والمراحل", detail: "وثائق تصميم اللعبة وتوازن اللعب والسرد", key: "ANTHROPIC_API_KEY" },
  { name: "DeepSeek Game Programmer", providerId: "deepseek", category: "games", tasks: "برمجة منطق اللعبة وحل المشكلات", detail: "مساعدة برمجية لبناء أنظمة اللعب", key: "DEEPSEEK_API_KEY + DEEPSEEK_MODEL" },

  { name: "OpenAI Film Director", providerId: "openai", category: "cinema", tasks: "المعالجة السينمائية والإخراج واللقطات", detail: "تطوير السيناريو ورؤية المخرج وخطة التصوير", key: "OPENAI_API_KEY" },
  { name: "Claude Screenwriter", providerId: "anthropic", category: "cinema", tasks: "كتابة السيناريو والحوار", detail: "بناء الشخصيات والمشاهد والحوار السينمائي", key: "ANTHROPIC_API_KEY" },
  { name: "Kling AI 4.0", providerId: "kling", category: "cinema", tasks: "توليد فيديو سينمائي حتى 4K", detail: "موصل Kling 4.0 الأصلي؛ يتطلب مفتاح API ورصيداً وصلاحية للنموذج", key: "KLING_API_KEY" },
  { name: "Runway Film Engine", providerId: "runway", category: "cinema", tasks: "توليد الفيديو والمشاهد", detail: "محرك فيديو عبر نقطة النهاية والنموذج المحددين في الحساب", key: "RUNWAY_API_KEY" },
  { name: "Luma Dream Machine", providerId: "luma", category: "cinema", tasks: "إنشاء مشاهد سينمائية", detail: "توليد مقاطع وفق إمكانات النموذج المتاح", key: "LUMA_API_KEY" },
  { name: "Gemini Omni Cinema", providerId: "google", category: "cinema", tasks: "توليد فيديو قصير من الوصف", detail: "فيديو عبر Gemini Omni حسب أهلية النموذج والحساب", key: "GOOGLE_AI_API_KEY" },

  { name: "OpenAI Series Writer", providerId: "openai", category: "series", tasks: "تطوير المسلسل والحلقات", detail: "خريطة الموسم وأقواس الشخصيات ومخططات الحلقات", key: "OPENAI_API_KEY" },
  { name: "Claude Series Room", providerId: "anthropic", category: "series", tasks: "كتابة الحلقات والسيناريو", detail: "تطوير عالم المسلسل واستمرارية الشخصيات والحوار", key: "ANTHROPIC_API_KEY" },

  { name: "fal.ai Video Engine", providerId: "fal", category: "video", tasks: "توليد الفيديو عبر نماذج متعددة", detail: "يستخدم نقطة نهاية الفيديو المحددة في FAL_VIDEO_MODEL", key: "FAL_KEY + FAL_VIDEO_MODEL" },
  { name: "OpenAI Image Engine", providerId: "openai", category: "image", tasks: "إنشاء الصور وتحريرها", detail: "توليد الصور من النص وتعديلها وفق دعم النموذج", key: "OPENAI_API_KEY" },
  { name: "ElevenLabs Voice Engine", providerId: "elevenlabs", category: "audio", tasks: "التعليق الصوتي وتحويل النص إلى كلام", detail: "توليد الصوت وفق الصوت والنموذج المحددين", key: "ELEVENLABS_API_KEY" },
  { name: "NEXORA AI Assistant", providerId: "openai", category: "assistant", tasks: "المساعدة العامة والبحث والتخطيط", detail: "مساعد المنصة متعدد الاستخدامات", key: "OPENAI_API_KEY" }
] as const;

const categories: { id: Category; label: string; icon: typeof Bot }[] = [
  { id: "all", label: "كل المحركات", icon: Bot },
  { id: "coding", label: "البرمجة والتكويد", icon: Code2 },
  { id: "software", label: "البرامج والأنظمة", icon: Layers3 },
  { id: "webapps", label: "المواقع والتطبيقات", icon: Code2 },
  { id: "games", label: "الألعاب", icon: Gamepad2 },
  { id: "cinema", label: "السينما والأفلام", icon: Clapperboard },
  { id: "series", label: "المسلسلات", icon: Film },
  { id: "video", label: "الفيديو", icon: Video },
  { id: "image", label: "الصور", icon: ImageIcon },
  { id: "audio", label: "الصوت", icon: AudioLines },
  { id: "assistant", label: "المساعد الذكي", icon: Bot }
];

function iconFor(category: string) {
  if (["coding", "software", "webapps"].includes(category)) return <Code2 size={20} />;
  if (category === "games") return <Gamepad2 size={20} />;
  if (category === "cinema") return <Clapperboard size={20} />;
  if (category === "series") return <Film size={20} />;
  if (category === "video") return <Video size={20} />;
  if (category === "image") return <ImageIcon size={20} />;
  if (category === "audio") return <AudioLines size={20} />;
  return <Bot size={20} />;
}

export default function ModelDirectory() {
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [integrated, setIntegrated] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetch("/api/system/status", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      const next: Record<string, boolean> = {};
      const connected: Record<string, boolean> = {};
      for (const provider of data.providers || []) { next[provider.id] = Boolean(provider.configured); connected[provider.id] = Boolean(provider.integrated); }
      setConfigured(next);
      setIntegrated(connected);
    }).catch(() => setConfigured({}));
  }, []);

  const visible = useMemo(() => engines.filter((engine) =>
    (category === "all" || engine.category === category) &&
    (engine.name.toLowerCase().includes(query.toLowerCase()) || engine.tasks.includes(query) || engine.detail.includes(query))
  ), [category, query]);

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">منظومة الذكاء الاصطناعي</span><h1>مكتبة المحركات</h1><p>25 محركاً موزعاً على 10 تخصصات مستقلة؛ كل محرك مرتبط بموصل API محدد.</p></div><span className="portal-heading-icon"><Bot size={25} /></span></div>
      <div className="engine-notice"><ShieldCheck size={19} /><div><b>حالة الربط بشفافية</b><p>الموصل الجاهز يعني أن التكامل البرمجي موجود. لا نعرض المحرك على أنه يعمل قبل إضافة المفتاح وإجراء اختبار فعلي ناجح.</p></div></div>
      <div className="engine-stats"><div><strong>{engines.length}</strong><span>محركاً ضمن الخطة</span></div><div><strong>10</strong><span>تخصصات مستقلة</span></div><div><strong>2K / 4K</strong><span>حسب دعم كل نموذج</span></div></div>
      <div className="engine-tools"><div className="engine-tabs">{categories.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setCategory(item.id)} className={category === item.id ? "engine-tab active" : "engine-tab"}><Icon size={15} />{item.label}</button>; })}</div><label className="engine-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن محرك..." /></label></div>
      <div className="engine-grid">{visible.map((engine) => <article className="engine-card" key={engine.name}><div className="engine-card-top"><span className="engine-avatar">{iconFor(engine.category)}</span><span className={configured[engine.providerId] ? "engine-status engine-configured" : integrated[engine.providerId] ? "engine-status engine-integrated" : "engine-status"}><i />{configured[engine.providerId] && integrated[engine.providerId] ? "المفتاح موجود · يحتاج اختبار فعلي" : configured[engine.providerId] ? "المفتاح موجود · الموصل غير مفعّل" : integrated[engine.providerId] ? "الموصل جاهز · أضف المفتاح" : "غير مربوط"}</span></div><h2>{engine.name}</h2><b className="engine-task">{engine.tasks}</b><p>{engine.detail}</p><div className="engine-key">متغير الربط: <code>{engine.key}</code></div></article>)}</div>
      {visible.length === 0 && <p className="engine-empty">ما لقينا محركاً مطابقاً لبحثك.</p>}
      <div className="engine-foot"><CheckCircle2 size={17} /><span>كل تخصص له محركاته المستقلة؛ توفر الخدمة الفعلي يعتمد على مفاتيح المزودين وإتاحتها واختبارها.</span></div>
    </section>
  </main>;
}
