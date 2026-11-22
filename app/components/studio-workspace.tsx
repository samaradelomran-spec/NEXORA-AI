"use client";

import { useEffect, useState } from "react";
import { Bookmark, CheckCircle2, FilePlus2, Sparkles } from "lucide-react";
import AIChat from "./ai-chat";
import ImageStudio from "./image-studio";
import VideoStudio from "./video-studio";
import AudioStudio from "./audio-studio";
import CreativeStudio from "./creative-studio";

type Props = { id: string; title: string; desc: string; initialPrompt?: string };
type Draft = { id: string; studio: string; title: string; prompt: string; format: string; resolution: string; createdAt: string };

const formats: Record<string, string[]> = {
  web: ["موقع إلكتروني", "تطبيق ويب", "صفحة هبوط", "لوحة تحكم"],
  games: ["لعبة ثنائية الأبعاد", "لعبة ثلاثية الأبعاد", "شخصية لعبة", "بيئة ومراحل"],
  images: ["صورة واقعية", "رسم فني", "تصميم منتج", "ملصق إعلاني"],
  videos: ["فيديو قصير", "إعلان", "مشهد سينمائي", "فيديو من صور"],
  cinema: ["فكرة فيلم", "مشهد سينمائي", "لوحة مشاهد", "سيناريو"],
  series: ["مسلسل", "حلقة", "شخصيات", "سيناريو حلقة"],
  audio: ["تعليق صوتي", "مؤثرات صوتية", "موسيقى", "تنقية صوت"],
  assistant: ["كتابة وتخطيط", "بحث وتحليل", "برمجة", "عصف ذهني"]
};

export default function StudioWorkspace({ id, title, desc, initialPrompt = "" }: Props) {
  const [format, setFormat] = useState((formats[id] || formats.assistant)[0]);
  const [resolution, setResolution] = useState("2K");
  const [prompt, setPrompt] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nexora-local-drafts");
      if (stored) setDrafts(JSON.parse(stored) as Draft[]);
    } catch { /* Ignore unavailable local storage */ }
  }, []);

  useEffect(() => { setFormat((formats[id] || formats.assistant)[0]); setSaved(false); }, [id]);

  function saveDraft() {
    if (!prompt.trim()) return;
    const next: Draft[] = [{
      id: `${Date.now()}`, studio: title, title: format, prompt: prompt.trim(),
      format, resolution: id === "images" || id === "videos" ? resolution : "غير مطبق",
      createdAt: new Date().toLocaleString("ar")
    }, ...drafts].slice(0, 30);
    setDrafts(next);
    try { localStorage.setItem("nexora-local-drafts", JSON.stringify(next)); } catch { /* Storage may be unavailable */ }
    setSaved(true);
  }

  return (
    <section className="workspace-detail" aria-label={title}>
      <div className="workspace-detail-head">
        <div><span className="section-kicker">مساحة العمل · {title}</span><h2>{title}</h2><p>{desc}</p></div>
        <span className="workspace-detail-icon"><Sparkles size={20} /></span>
      </div>
      {id === "assistant" ? <AIChat initialPrompt={initialPrompt} /> : id === "images" ? <ImageStudio /> : id === "videos" ? <VideoStudio /> : id === "audio" ? <AudioStudio /> : ["web", "games", "cinema", "series"].includes(id) ? <CreativeStudio studio={id as "web" | "games" | "cinema" | "series"} /> : <>
      <div className="workspace-fields">
        <label>نوع المشروع
          <select value={format} onChange={(e) => { setFormat(e.target.value); setSaved(false); }}>
            {(formats[id] || formats.assistant).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {(id === "images" || id === "videos") && <label>الدقة المستهدفة
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="2K">2K — عند دعم المحرك</option>
            <option value="4K">4K — عند دعم المحرك</option>
            <option value="1080p">1080p</option>
          </select>
        </label>}
      </div>
      <label className="workspace-prompt-label">صف فكرتك بالتفصيل
        <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setSaved(false); }} rows={5} placeholder="اكتب وصف المشروع، الأسلوب، التفاصيل والنتيجة التي تتوقعها..." />
      </label>
      <div className="workspace-actions">
        <button className="workspace-save" onClick={saveDraft} disabled={!prompt.trim()}><Bookmark size={16} /> حفظ كمسودة</button>
        <span className="workspace-hint">المسودات تُحفظ محلياً على هذا الجهاز. التوليد الفعلي يحتاج ربط محرك مناسب.</span>
      </div>
      {saved && <div className="workspace-success"><CheckCircle2 size={16} /> تم حفظ المسودة على هذا الجهاز.</div>}
      <div className="drafts-heading"><div><FilePlus2 size={17} /><b>مسوداتك المحفوظة</b></div><span>{drafts.length} / 30</span></div>
      {drafts.length > 0 ? <div className="draft-list">{drafts.slice(0, 4).map((draft) => <article className="draft-item" key={draft.id}><div><b>{draft.title}</b><small>{draft.studio} · {draft.createdAt}</small><p>{draft.prompt}</p></div><button onClick={() => { setPrompt(draft.prompt); setFormat(draft.format); setSaved(false); }}>فتح المسودة</button></article>)}</div> : <p className="draft-empty">ما في مسودات محفوظة بعد. اكتب فكرتك واحفظها لتلاقيها هون.</p>}
      </>}
    </section>
  );
}
