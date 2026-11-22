"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Music2, Play } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function MusicStudio() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("30");
  const [instrumental, setInstrumental] = useState(true);
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function token() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function generate() {
    if (!prompt.trim() || busy) return;
    const accessToken = await token();
    if (!accessToken) { setNotice("سجّل الدخول أولاً لإنشاء الموسيقى."); return; }
    setBusy(true); setNotice(""); setAudioUrl(""); setJobId(""); setStatus("PENDING");
    try {
      const response = await fetch("/api/ai/music", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ prompt, duration: Number(duration), instrumental })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إرسال الموسيقى.");
      setJobId(data.jobId); setNotice("تم إرسال الموسيقى إلى Runway.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ.");
      setBusy(false); setStatus("");
    }
  }

  useEffect(() => {
    if (!jobId || audioUrl || status === "FAILED") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const accessToken = await token();
      if (!accessToken) { if (active) { setNotice("انتهت جلسة الدخول."); setBusy(false); } return; }
      try {
        const response = await fetch("/api/ai/music?jobId=" + encodeURIComponent(jobId), { headers: { Authorization: "Bearer " + accessToken } });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "تعذر فحص الموسيقى.");
        setStatus(data.status);
        if (data.status === "COMPLETED" && data.audioUrl) { setAudioUrl(data.audioUrl); setBusy(false); setNotice("اكتمل إنشاء المقطع الموسيقي."); return; }
        if (data.status === "FAILED") { setBusy(false); setNotice(data.error || "فشل إنشاء الموسيقى."); return; }
        timer = setTimeout(poll, 5000);
      } catch (error) {
        if (active) { setNotice(error instanceof Error ? error.message : "تعذر فحص الموسيقى."); setBusy(false); }
      }
    };
    timer = setTimeout(poll, 4000);
    return () => { active = false; clearTimeout(timer); };
  }, [jobId, audioUrl, status]);

  return <section className="music-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">توليد الموسيقى</span><h3>استوديو الموسيقى والمؤثرات</h3><p>أنشئ موسيقى خلفية أو مقطعاً صوتياً حسب وصفك.</p></div><span><Music2 size={22} /></span></div>
    <label className="image-prompt-label">وصف المقطع<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="مثال: موسيقى سينمائية غامضة بتصاعد تدريجي، أوتار منخفضة وطبول بطيئة..." /></label>
    <div className="music-controls"><label>المدة<select value={duration} onChange={(e) => setDuration(e.target.value)} disabled={busy}><option value="15">15 ثانية</option><option value="30">30 ثانية</option><option value="60">60 ثانية</option><option value="90">90 ثانية</option></select></label><label className="music-check"><input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} disabled={busy} /> موسيقى بدون غناء</label></div>
    <button className="image-generate-btn" onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}{busy ? "جارٍ إنشاء الموسيقى..." : "إنشاء الموسيقى"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    {busy && <div className="video-progress"><LoaderCircle size={16} className="spin" /> الموسيقى قيد المعالجة لدى Runway...</div>}
    {audioUrl && <div className="audio-result"><audio controls src={audioUrl} /><a href={audioUrl} target="_blank" rel="noreferrer">فتح الملف الصوتي</a></div>}
    <p className="image-studio-foot">يستخدم Runway Music (Eleven Music). المدة المطلوبة تؤثر على تكلفة التوليد. تجنب طلب تقليد فنان أو أغنية بعينها.</p>
  </section>;
}
