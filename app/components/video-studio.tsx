"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, LoaderCircle, Play } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function VideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("2K");
  const [duration, setDuration] = useState("5");
  const [provider, setProvider] = useState<"fal" | "runway" | "luma" | "google">("fal");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [notice, setNotice] = useState("");

  async function accessToken() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function createVideo() {
    if (!prompt.trim() || busy) return;
    const token = await accessToken();
    if (!token) { setNotice("سجّل الدخول أولاً لإنشاء الفيديو."); return; }
    setBusy(true); setNotice(""); setVideoUrl(""); setJobId(""); setStatus("IN_QUEUE");
    try {
      const response = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ prompt, resolution, provider, duration: Number(duration) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إرسال مهمة الفيديو.");
      setJobId(data.jobId); setStatus(data.status || "IN_QUEUE"); setNotice("تم إرسال الفيديو إلى طابور التوليد.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ.");
      setBusy(false); setStatus("");
    }
  }

  useEffect(() => {
    if (!jobId || videoUrl || status === "FAILED") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const token = await accessToken();
      if (!token) { if (active) { setNotice("انتهت جلسة الدخول. سجّل الدخول مجدداً."); setBusy(false); } return; }
      try {
        const response = await fetch("/api/ai/video?jobId=" + encodeURIComponent(jobId), {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "تعذر فحص حالة الفيديو.");
        setStatus(data.status);
        if (data.status === "COMPLETED" && data.videoData) {
          const bytes = Uint8Array.from(atob(data.videoData), (character) => character.charCodeAt(0));
          const blob = new Blob([bytes], { type: "video/mp4" });
          const supabase = getSupabaseBrowserClient();
          const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
          let playableUrl = URL.createObjectURL(blob);
          if (supabase && user) {
            const path = user.id + "/uploads/" + Date.now() + "-gemini-video.mp4";
            const { error: storageError } = await supabase.storage.from("nexora-files").upload(path, blob, { contentType: "video/mp4", upsert: false });
            if (!storageError) {
              const { data: signed } = await supabase.storage.from("nexora-files").createSignedUrl(path, 3600);
              if (signed?.signedUrl) playableUrl = signed.signedUrl;
            }
          }
          setVideoUrl(playableUrl); setBusy(false); setNotice("اكتمل إنشاء الفيديو عبر Gemini Omni."); return;
        }
        if (data.status === "COMPLETED" && data.videoUrl) {
          let playableUrl = data.videoUrl as string;
          const supabase = getSupabaseBrowserClient();
          const downloadToken = await accessToken();
          if (supabase && downloadToken) {
            const download = await fetch("/api/ai/video/download?jobId=" + encodeURIComponent(jobId), { headers: { Authorization: "Bearer " + downloadToken } });
            if (download.ok) {
              const blob = await download.blob();
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const path = user.id + "/uploads/" + jobId + "-generated-video.mp4";
                const { error: storageError } = await supabase.storage.from("nexora-files").upload(path, blob, { contentType: blob.type || "video/mp4", upsert: true });
                if (!storageError) {
                  const { data: signed } = await supabase.storage.from("nexora-files").createSignedUrl(path, 3600);
                  if (signed?.signedUrl) playableUrl = signed.signedUrl;
                }
              }
            }
          }
          setVideoUrl(playableUrl); setBusy(false); setNotice("اكتمل إنشاء الفيديو. إذا كان التخزين السحابي مفعّلاً، حُفظت نسخة في ملفاتك."); return;
        }
        if (data.status === "FAILED") { setBusy(false); setNotice(data.error || "فشل إنشاء الفيديو."); return; }
        timer = setTimeout(poll, 5000);
      } catch (error) {
        if (active) { setNotice(error instanceof Error ? error.message : "تعذر فحص الفيديو."); setBusy(false); }
      }
    };
    timer = setTimeout(poll, 4000);
    return () => { active = false; clearTimeout(timer); };
  }, [jobId, videoUrl, status]);

  return <section className="video-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">طابور توليد الفيديو</span><h3>استوديو الفيديو والسينما</h3><p>صف المشهد والحركة وأسلوب التصوير الذي تريده.</p></div><span><Clapperboard size={22} /></span></div>
    <label className="image-prompt-label">وصف الفيديو<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="مثال: لقطة سينمائية لمدينة ليلية تحت المطر، حركة كاميرا بطيئة وإضاءة واقعية..." /></label>
    <div className="video-engine-select"><label>محرك الفيديو<select value={provider} onChange={(e) => { const next = e.target.value as "fal" | "runway" | "luma" | "google"; setProvider(next); if (next === "google") setResolution("1080p"); else if (next === "runway" && resolution !== "4K") setResolution("720p"); else if (next === "fal" && resolution === "720p") setResolution("2K"); else if (next === "luma" && ["2K", "720p"].includes(resolution)) setResolution("1080p"); }} disabled={busy}><option value="fal">fal.ai</option><option value="runway">Runway</option><option value="luma">Luma Dream Machine</option><option value="google">Google Gemini Omni</option></select></label><label>المدة<select value={duration} onChange={(e) => setDuration(e.target.value)} disabled={busy || provider === "luma" || provider === "google"}><option value="5">{provider === "google" ? "تلقائية حسب المحرك" : "5 ثوانٍ"}</option>{provider !== "luma" && provider !== "google" && <><option value="10">10 ثوانٍ</option><option value="15">15 ثانية</option></>}</select></label></div>
    {provider === "fal" ? <label className="video-resolution-label">الدقة المستهدفة<select value={resolution} onChange={(e) => setResolution(e.target.value)} disabled={busy}><option value="2K">2K</option><option value="4K">4K (حسب دعم النموذج)</option><option value="1080p">1080p</option></select></label> : provider === "luma" ? <label className="video-resolution-label">الدقة المستهدفة<select value={resolution} onChange={(e) => setResolution(e.target.value)} disabled={busy}><option value="1080p">1080p</option><option value="4K">4K (خطة Pro)</option></select></label> : provider === "google" ? <label className="video-resolution-label">الدقة المستهدفة<select value={resolution} onChange={(e) => setResolution(e.target.value)} disabled={busy}><option value="720p">720p</option><option value="1080p">1080p</option><option value="4K">4K (Pro + إتاحة Google)</option></select></label> : <><label className="video-resolution-label">الدقة المستهدفة<select value={resolution === "4K" ? "4K" : "720p"} onChange={(e) => setResolution(e.target.value)} disabled={busy}><option value="720p">720p</option><option value="4K">4K (Seedance 2.5 · Pro)</option></select></label><p className="video-engine-note">Runway يستخدم Seedance 2.5 افتراضياً: 720p، مع خيار 4K عند اختيار هذا النموذج وخطة Pro.</p></>}
    <button className="image-generate-btn" onClick={() => void createVideo()} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}{busy ? "الفيديو قيد المعالجة..." : "إنشاء الفيديو"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    {busy && <div className="video-progress"><LoaderCircle size={16} className="spin" /> الحالة: {status === "IN_PROGRESS" || status === "RUNNING" ? "المحرك ينشئ الفيديو الآن" : "في انتظار دور المحرك"} — قد يستغرق عدة دقائق.</div>}
    {videoUrl && <div className="video-result"><video src={videoUrl} controls playsInline /><a href={videoUrl} target="_blank" rel="noreferrer">فتح الفيديو في نافذة جديدة</a></div>}
    <p className="image-studio-foot">اختر fal.ai أو Runway أو Luma. لكل محرك مفتاح ونموذج وإمكانات دقة مختلفة؛ 4K متاحة فقط عند دعم المحرك والخطة.</p>
  </section>;
}
