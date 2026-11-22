"use client";

import { useState } from "react";
import Link from "next/link";
import { AudioLines, Download, LoaderCircle, Mic2 } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function AudioStudio() {
  const [text, setText] = useState("");
  const [audio, setAudio] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function generate() {
    if (!text.trim() || busy) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setNotice("إعداد Supabase غير موجود بعد."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setNotice("سجّل الدخول أولاً لإنشاء الصوت."); return; }
    setBusy(true); setAudio(""); setNotice("");
    try {
      const response = await fetch("/api/ai/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الصوت.");
      setAudio("data:" + data.mimeType + ";base64," + data.audio);
      setNotice("تم إنشاء الملف الصوتي بنجاح عبر ElevenLabs.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الصوت.");
    } finally { setBusy(false); }
  }

  return <section className="audio-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">تحويل النص إلى صوت</span><h3>استوديو الصوت والتعليق</h3><p>اكتب النص الذي تريد تحويله إلى تعليق صوتي.</p></div><span><AudioLines size={22} /></span></div>
    <label className="image-prompt-label">النص الصوتي<textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="اكتب النص بالعربية أو اللغة التي تريدها..." /></label>
    <button className="image-generate-btn" onClick={() => void generate()} disabled={busy || !text.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Mic2 size={17} />}{busy ? "جارٍ إنشاء الصوت..." : "إنشاء التعليق الصوتي"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    {audio && <div className="audio-result"><audio controls src={audio} /><a href={audio} download="nexora-voiceover.mp3"><Download size={16} /> تنزيل الملف الصوتي</a></div>}
    <p className="image-studio-foot">يحتاج هذا الاستوديو إلى ELEVENLABS_API_KEY ومعرّف صوت افتراضي في إعدادات الاستضافة. جودة الصوت واللغات تعتمد على النموذج والصوت المختارين.</p>
  </section>;
}
