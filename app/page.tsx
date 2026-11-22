"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, AudioLines, Bell, Blocks, Bot, ChevronDown, Clapperboard,
  Code2, Film, Gamepad2, Image as ImageIcon, LayoutDashboard, Menu,
  Plus, Search, Settings2, Sparkles, WandSparkles, Video, X
} from "lucide-react";

const studios = [
  { id: "web", title: "استوديو المواقع والتطبيقات", desc: "حوّل فكرتك إلى موقع أو تطبيق متكامل.", icon: Code2, color: "violet", tag: "الأكثر استخداماً" },
  { id: "games", title: "استوديو الألعاب", desc: "ابتكر عوالم وشخصيات وتجارب ألعاب.", icon: Gamepad2, color: "blue", tag: "جديد" },
  { id: "images", title: "استوديو الصور", desc: "أنشئ الصور وعدّلها وارفع جودتها.", icon: ImageIcon, color: "pink", tag: "2K عند الدعم" },
  { id: "videos", title: "استوديو الفيديو", desc: "حوّل النصوص والأفكار إلى فيديو.", icon: Video, color: "cyan", tag: "2K / 4K حسب المحرك" },
  { id: "cinema", title: "استوديو السينما والأفلام", desc: "خطّط المشاهد واللقطات والأفلام.", icon: Clapperboard, color: "amber", tag: "سينمائي" },
  { id: "series", title: "استوديو المسلسلات", desc: "طوّر الحلقات والشخصيات والسيناريو.", icon: Film, color: "rose", tag: "قصص طويلة" },
  { id: "audio", title: "استوديو الصوت", desc: "تعليق صوتي ومؤثرات وموسيقى.", icon: AudioLines, color: "green", tag: "صوت" },
  { id: "assistant", title: "المساعد الذكي", desc: "اسأل، خطّط، حلّل وابدأ أي مشروع.", icon: Bot, color: "indigo", tag: "متعدد المهام" }
];

const suggestions = ["أنشئ موقعاً لمتجر إلكتروني", "صمّم شخصية لعبة خيالية", "اكتب فكرة إعلان فيديو قصير"];

export default function Home() {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => studios.filter((studio) =>
    (active === "all" || studio.id === active) &&
    (studio.title.includes(query) || studio.desc.includes(query))
  ), [active, query]);

  const startStudio = (title: string) => {
    setNotice(`تم اختيار ${title}. ربط محركات التوليد سيُفعّل بعد إعداد مفاتيح الخدمات.`);
    window.setTimeout(() => setNotice(""), 5000);
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={23} /></div>
          <div><strong>NEXORA<span> AI</span></strong><small>CREATE WITHOUT LIMITS</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة"><X /></button>
        </div>
        <div className="side-label">مساحة العمل</div>
        <button className={`nav-item ${active === "all" ? "selected" : ""}`} onClick={() => setActive("all")}><LayoutDashboard size={18} /> نظرة عامة</button>
        <div className="side-label">الاستوديوهات</div>
        {studios.map((studio) => {
          const Icon = studio.icon;
          return <button key={studio.id} className={`nav-item ${active === studio.id ? "selected" : ""}`} onClick={() => { setActive(studio.id); setMobileOpen(false); }}><Icon size={18} />{studio.title.replace("استوديو ", "")}</button>;
        })}
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-top"><Sparkles size={16} /> <b>ابدأ رحلتك الإبداعية</b></div><p>ستظهر هنا تفاصيل خطتك واستخدامك بعد تفعيل الحسابات.</p><button onClick={() => setNotice("سيتم تفعيل الخطط والاشتراكات بعد إعداد نظام الحسابات والدفع.")}>استكشف الخطط <ArrowLeft size={15} /></button></div>
          <button className="nav-item"><Settings2 size={18} /> الإعدادات</button>
        </div>
      </aside>

      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />}

      <section className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة"><Menu /></button>
          <div className="breadcrumb">مساحة العمل <span>/</span> <b>نظرة عامة</b></div>
          <div className="top-actions"><button className="icon-btn" aria-label="بحث"><Search size={18} /></button><button className="icon-btn notification" aria-label="الإشعارات"><Bell size={18} /></button><div className="avatar">N</div></div>
        </header>

        <div className="content">
          <section className="hero">
            <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
            <div className="hero-content">
              <div className="eyebrow"><span className="live-dot" /> مساحة الإبداع الذكي</div>
              <h1>كل أفكارك تبدأ من <span>هنا.</span></h1>
              <p>من الفكرة الأولى إلى النتيجة النهائية، اجمع أقوى أدوات الإبداع بالذكاء الاصطناعي في مساحة واحدة.</p>
              <a className="hero-link" href="#studios">اكتشف الاستوديوهات <ArrowLeft size={17} /></a>
            </div>
            <div className="hero-symbol"><div className="symbol-ring ring-a" /><div className="symbol-ring ring-b" /><div className="symbol-core"><WandSparkles size={43} /></div><span className="spark spark-a">✦</span><span className="spark spark-b">✧</span></div>
            <div className="hero-foot"><span>01 / WORKSPACE</span><span>خيالك هو نقطة البداية</span></div>
          </section>

          <section className="prompt-panel" id="workspace">
            <div className="prompt-heading"><div><span className="section-kicker">ابدأ الآن</span><h2>ما الذي تريد إنشاءه اليوم؟</h2></div><span className="prompt-icon"><Sparkles size={20} /></span></div>
            <div className="prompt-input-wrap"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="اكتب فكرتك هنا... صف ما تريد إنشاءه بالتفصيل" rows={3} /><button className="generate-btn" onClick={() => setNotice(prompt.trim() ? "وصلت فكرتك إلى مساحة العمل. سيتم تفعيل التوليد عند ربط محركات الذكاء الاصطناعي." : "اكتب فكرتك أولاً، ثم اضغط ابدأ الإنشاء.")}>ابدأ الإنشاء <WandSparkles size={17} /></button></div>
            <div className="suggestions">{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
          </section>

          <section className="studios-section" id="studios">
            <div className="section-heading"><div><span className="section-kicker">مساحة أدواتك</span><h2>استوديوهات NEXORA</h2><p>اختر الاستوديو المناسب وحوّل فكرتك إلى مشروع.</p></div><div className="studio-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن استوديو..." /></div></div>
            <div className="filter-row"><button className={active === "all" ? "filter active-filter" : "filter"} onClick={() => setActive("all")}>الكل <span>08</span></button>{studios.map((s) => <button key={s.id} className={active === s.id ? "filter active-filter" : "filter"} onClick={() => setActive(s.id)}>{s.title.replace("استوديو ", "").replace(" والمشاريع", "")}</button>)}</div>
            <div className="studio-grid">{filtered.map((studio) => { const Icon = studio.icon; return <article className="studio-card" key={studio.id}><div className={`studio-icon ${studio.color}`}><Icon size={23} /></div><span className="studio-tag">{studio.tag}</span><h3>{studio.title}</h3><p>{studio.desc}</p><button className="card-action" onClick={() => startStudio(studio.title)}>افتح الاستوديو <ArrowLeft size={16} /></button></article>; })}</div>
            {filtered.length === 0 && <div className="empty-state">ما لقينا استوديو بهذا الاسم. جرّب كلمة ثانية.</div>}
          </section>

          <section className="bottom-note"><div className="note-icon"><Blocks size={20} /></div><div><b>منصة واحدة، إمكانيات متعددة</b><p>ستتم إضافة المشاريع المحفوظة، الحسابات، والمحركات المتصلة ضمن مراحل البناء التالية.</p></div><ChevronDown size={18} /></section>
          <footer><span>© 2026 NEXORA AI</span><span>صُنع للإبداع بلا حدود</span><span>الإصدار الأولي · واجهة تجريبية</span></footer>
        </div>
      </section>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
