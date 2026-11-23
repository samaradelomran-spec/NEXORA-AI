"use client";

import { useMemo, useState } from "react";
import StudioWorkspace from "./components/studio-workspace";
import AccountControl from "./components/account-control";
import Link from "next/link";
import {
  ArrowLeft, AudioLines, Bell, Blocks, Bot, Check, ChevronLeft, Clapperboard,
  Code2, Film, Gamepad2, Image as ImageIcon, LayoutDashboard, Menu,
  Search, Settings2, ShieldCheck, Sparkles, WandSparkles, Video, X, FolderOpen,
  Layers3, Zap, Command, CircleHelp
} from "lucide-react";

const studios = [
  { id: "coding", title: "استوديو البرمجة والتكويد", desc: "اكتب الكود، أصلح الأخطاء، وابنِ الحلول البرمجية.", icon: Code2, color: "violet", tag: "برمجة وتطوير" },
  { id: "software", title: "استوديو إنشاء البرامج والأنظمة", desc: "صمّم البرامج والأنظمة وقواعد البيانات وواجهاتها.", icon: Blocks, color: "blue", tag: "هندسة الأنظمة" },
  { id: "web", title: "استوديو المواقع والتطبيقات", desc: "ابنِ مواقع وتطبيقات متكاملة من وصف بسيط.", icon: Code2, color: "violet", tag: "إنشاء وتطوير" },
  { id: "games", title: "استوديو الألعاب", desc: "صمّم عوالم وشخصيات وتجارب تفاعلية.", icon: Gamepad2, color: "blue", tag: "تجارب تفاعلية" },
  { id: "images", title: "استوديو الصور", desc: "أنشئ الصور، حرّرها، وحسّن تفاصيلها.", icon: ImageIcon, color: "pink", tag: "صورة وتصميم" },
  { id: "videos", title: "استوديو الفيديو", desc: "حوّل النصوص والأفكار إلى فيديو.", icon: Video, color: "cyan", tag: "فيديو ذكي" },
  { id: "cinema", title: "استوديو السينما والأفلام", desc: "خطّط المشاهد واللقطات والأفلام.", icon: Clapperboard, color: "amber", tag: "إنتاج سينمائي" },
  { id: "series", title: "استوديو المسلسلات", desc: "طوّر الحلقات والشخصيات والسيناريو.", icon: Film, color: "rose", tag: "سرد قصصي" },
  { id: "audio", title: "استوديو الصوت", desc: "أنشئ التعليق الصوتي والمؤثرات والموسيقى.", icon: AudioLines, color: "green", tag: "صوت وموسيقى" },
  { id: "assistant", title: "المساعد الذكي", desc: "اسأل، خطّط، حلّل وابدأ أي مشروع.", icon: Bot, color: "indigo", tag: "مساعد متعدد المهام" }
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

  const startStudio = (title: string, id: string) => {
    setActive(id);
    setNotice(`تم فتح ${title}. يمكنك الآن إعداد فكرتك وحفظها كمسودة.`);
    window.setTimeout(() => setNotice(""), 5000);
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="nx-shell">
      <aside className={`nx-sidebar ${mobileOpen ? "nx-sidebar-open" : ""}`}>
        <Link href="/" className="nx-brand">
          <span className="nx-brand-mark">N</span>
          <span><b>NEXORA <i>AI</i></b><small>CREATIVE INTELLIGENCE</small></span>
          <button className="nx-icon-btn nx-mobile-close" onClick={(event) => { event.preventDefault(); setMobileOpen(false); }} aria-label="إغلاق القائمة"><X size={18} /></button>
        </Link>
        <div className="nx-side-caption">WORKSPACE</div>
        <button className={`nx-nav-item ${active === "all" ? "is-active" : ""}`} onClick={() => { setActive("all"); setMobileOpen(false); }}><LayoutDashboard size={17} /> نظرة عامة</button>
        <div className="nx-side-caption">AI STUDIOS</div>
        {studios.map((studio) => {
          const Icon = studio.icon;
          return <button key={studio.id} className={`nx-nav-item ${active === studio.id ? "is-active" : ""}`} onClick={() => { setActive(studio.id); setMobileOpen(false); }}><Icon size={17} />{studio.title.replace("استوديو ", "")}</button>;
        })}
        <div className="nx-side-caption">YOUR SPACE</div>
        <Link className="nx-nav-item" href="/projects"><FolderOpen size={17} /> مشاريعي</Link>
        <Link className="nx-nav-item" href="/files"><Blocks size={17} /> ملفاتي السحابية</Link>
        <Link className="nx-nav-item" href="/models"><Layers3 size={17} /> مكتبة المحركات</Link>
        <Link className="nx-nav-item" href="/activity"><Bell size={17} /> سجل العمليات</Link>
        <div className="nx-sidebar-bottom">
          <div className="nx-upgrade">
            <div className="nx-upgrade-icon"><Zap size={17} /></div>
            <b>ارتقِ بتجربتك</b>
            <p>اكتشف مزايا Pro وحدود الاستخدام الأعلى.</p>
            <Link href="/pricing">استكشف الخطط <ArrowLeft size={14} /></Link>
          </div>
          <Link className="nx-nav-item" href="/settings"><Settings2 size={17} /> الإعدادات</Link>
          <Link className="nx-nav-item" href="/admin"><ShieldCheck size={17} /> لوحة الإدارة</Link>
        </div>
      </aside>

      {mobileOpen && <button className="nx-scrim" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />}

      <section className="nx-main">
        <header className="nx-topbar">
          <div className="nx-topbar-start">
            <button className="nx-icon-btn nx-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة"><Menu size={19} /></button>
            <div className="nx-breadcrumb"><span>مساحة العمل</span><ChevronLeft size={13} /><b>{active === "all" ? "نظرة عامة" : studios.find((s) => s.id === active)?.title}</b></div>
          </div>
          <div className="nx-topbar-actions">
            <button className="nx-search-shortcut" onClick={() => { document.getElementById("nx-studio-search")?.focus(); document.getElementById("nx-studios")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={16} /><span>ابحث عن أداة...</span><kbd>⌘ K</kbd></button>
            <Link href="/activity" className="nx-icon-btn" aria-label="الإشعارات"><Bell size={17} /></Link>
            <AccountControl />
          </div>
        </header>

        <div className="nx-content">
          <section className="nx-hero">
            <div className="nx-hero-copy">
              <div className="nx-eyebrow"><span /> منصة إبداع متكاملة بالذكاء الاصطناعي</div>
              <h1>من الفكرة إلى <em>الإنجاز.</em><br />كل أدواتك في مساحة واحدة.</h1>
              <p>أنشئ مواقع وصوراً وفيديو وألعاباً ومشاريع إبداعية عبر مساحة عمل واحدة مصممة لتمنحك تحكماً أكبر وسير عمل أكثر سلاسة.</p>
              <div className="nx-hero-actions">
                <a href="#nx-studios" className="nx-primary-btn">استكشف الاستوديوهات <ArrowLeft size={16} /></a>
                <Link href="/projects" className="nx-quiet-btn">مشاريعي <FolderOpen size={16} /></Link>
              </div>
              <div className="nx-trust-line"><span><Check size={13} /> مساحة عمل موحدة</span><span><Check size={13} /> مشاريعك في مكان واحد</span><span><Check size={13} /> محركات متعددة حسب الإعداد</span></div>
            </div>
            <div className="nx-hero-art" aria-hidden="true">
              <div className="nx-art-grid" />
              <div className="nx-art-glow" />
              <div className="nx-orbit nx-orbit-one" /><div className="nx-orbit nx-orbit-two" />
              <div className="nx-glass-tile"><div className="nx-tile-top"><span /><span /><span /><small> NEXORA / STUDIO</small></div><div className="nx-tile-logo">N</div><div className="nx-tile-bottom"><i /><i /><i /><i /></div></div>
              <div className="nx-float-card nx-float-a"><ImageIcon size={16} /><span>إنشاء بصري</span><b>01</b></div>
              <div className="nx-float-card nx-float-b"><Video size={16} /><span>استوديو الفيديو</span><b>02</b></div>
              <div className="nx-art-caption">CREATE · BUILD · IMAGINE</div>
            </div>
            <div className="nx-hero-index">N° 01 <span>CREATIVE WORKSPACE</span></div>
          </section>

          <section className="nx-prompt-panel" id="workspace">
            <div className="nx-prompt-heading"><div><span className="nx-overline">ابدأ من هنا</span><h2>ما الذي تريد إنجازه اليوم؟</h2><p>اكتب فكرتك وسنساعدك في اختيار مساحة العمل المناسبة.</p></div><span className="nx-prompt-mark"><WandSparkles size={21} /></span></div>
            <div className="nx-prompt-entry"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="صف فكرتك بالتفصيل... مثلاً: أريد إنشاء إعلان سينمائي لمنتج جديد" rows={2} /><button onClick={() => { if (!prompt.trim()) { setNotice("اكتب فكرتك أولاً، ثم ابدأ."); return; } setActive("assistant"); setNotice("تم تجهيز فكرتك في المساعد الذكي. يمكنك متابعة إعدادها أدناه."); window.setTimeout(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }), 100); }}>ابدأ الإنشاء <WandSparkles size={16} /></button></div>
            <div className="nx-suggestions">{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
          </section>

          {active !== "all" && (() => { const selected = studios.find((item) => item.id === active); return selected ? <StudioWorkspace id={selected.id} title={selected.title} desc={selected.desc} initialPrompt={selected.id === "assistant" ? prompt : ""} /> : null; })()}

          <section className="nx-studios-section" id="nx-studios">
            <div className="nx-section-head"><div><span className="nx-overline">مساحة أدواتك</span><h2>استوديوهات <i>NEXORA</i></h2><p>كل تخصص إبداعي له مساحة وأدوات مخصصة.</p></div><label className="nx-studio-search"><Search size={16} /><input id="nx-studio-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن استوديو..." /></label></div>
            <div className="nx-studio-grid">{filtered.map((studio, index) => { const Icon = studio.icon; return <article className="nx-studio-card" key={studio.id}><div className="nx-card-top"><span className={`nx-studio-icon ${studio.color}`}><Icon size={21} /></span><small>{String(index + 1).padStart(2, "0")} / 10</small></div><span className="nx-studio-tag">{studio.tag}</span><h3>{studio.title}</h3><p>{studio.desc}</p><button onClick={() => startStudio(studio.title, studio.id)}>افتح الاستوديو <ArrowLeft size={15} /></button></article>; })}</div>
            {filtered.length === 0 && <div className="nx-empty">ما لقينا استوديو بهذا الاسم. جرّب كلمة ثانية.</div>}
          </section>

          <section className="nx-bottom-strip"><div className="nx-bottom-symbol"><Command size={19} /></div><div><b>مساحة واحدة. سير عمل أكثر وضوحاً.</b><p>تُحفظ مشاريعك ومسوداتك ضمن حسابك عند تفعيل خدمات الحساب والتخزين. توفر التوليد يعتمد على إعداد واختبار محركات الذكاء الاصطناعي.</p></div><Link href="/pricing">عرض الخطط <ArrowLeft size={14} /></Link></section>
          <footer className="nx-footer"><span>© 2026 NEXORA AI</span><span>صُممت لتوسيع آفاق الإبداع</span><Link href="/settings"><CircleHelp size={13} /> المساعدة والإعدادات</Link></footer>
        </div>
      </section>
      {notice && <div className="nx-toast" role="status">{notice}</div>}
    </main>
  );
}
