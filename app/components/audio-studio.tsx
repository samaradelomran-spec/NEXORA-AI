"use client";

import { useState } from "react";
import Link from "next/link";
import { AudioLines, Download, LoaderCircle, Mic2 } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import MusicStudio from "./music-studio";

export default function AudioStudio() {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<"elevenlabs" | "google">("elevenlabs");
  const [voice, setVoice] = useState("Kore");
  const [audio, setAudio] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [transcriptionProvider, setTranscriptionProvider] = useState<"deepgram" | "assemblyai">("deepgram");
  const [transcriptionFile, setTranscriptionFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState("");
  const [transcriptionBusy, setTranscriptionBusy] = useState(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState("");

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
        body: JSON.stringify({ text, provider, voice })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الصوت.");
      const preview = "data:" + data.mimeType + ";base64," + data.audio;
      setAudio(preview);
      const bytes = Uint8Array.from(atob(data.audio), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.mimeType });
      const path = session.user.id + "/uploads/" + Date.now() + (data.mimeType === "audio/wav" ? "-voiceover.wav" : "-voiceover.mp3");
      const { error: storageError } = await supabase.storage.from("nexora-files").upload(path, blob, { contentType: data.mimeType, upsert: false });
      if (storageError) setNotice("تم إنشاء الصوت، لكن التخزين السحابي لم يُفعّل بعد.");
      else {
        const { data: signed } = await supabase.storage.from("nexora-files").createSignedUrl(path, 3600);
        if (signed?.signedUrl) setAudio(signed.signedUrl);
        setNotice("تم إنشاء الصوت وحفظ نسخة منه سحابياً. هذا صوت مولّد بالذكاء الاصطناعي.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الصوت.");
    } finally { setBusy(false); }
  }

  async function transcribe() {
    if (!transcriptionFile || transcriptionBusy) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setTranscriptionNotice("إعداد Supabase غير موجود بعد."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setTranscriptionNotice("سجّل الدخول أولاً لتفريغ الصوت."); return; }
    setTranscriptionBusy(true); setTranscription(""); setTranscriptionNotice("");
    try {
      const form = new FormData();
      form.set("file", transcriptionFile);
      form.set("provider", transcriptionProvider);
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تفريغ الملف.");
      if (data.status === "COMPLETED" && data.transcript) {
        setTranscription(data.transcript);
        setTranscriptionNotice("اكتمل تفريغ الملف بنجاح.");
      } else if (data.jobId) {
        setTranscriptionNotice("أُرسلت المهمة إلى AssemblyAI، جارٍ انتظار النتيجة...");
        let finished = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const poll = await fetch("/api/ai/transcribe?jobId=" + encodeURIComponent(data.jobId), {
            headers: { Authorization: "Bearer " + session.access_token }
          });
          const result = await poll.json();
          if (!poll.ok) throw new Error(result.error || "تعذر فحص مهمة التفريغ.");
          if (result.status === "COMPLETED" && result.transcript) {
            setTranscription(result.transcript);
            setTranscriptionNotice("اكتمل تفريغ الملف عبر AssemblyAI.");
            finished = true;
            break;
          }
          if (result.status === "FAILED") throw new Error(result.error || "فشل تفريغ الملف.");
        }
        if (!finished) throw new Error("ما زالت المهمة قيد المعالجة. أعد فتح النشاط لاحقاً للتحقق من النتيجة.");
      }
    } catch (error) {
      setTranscriptionNotice(error instanceof Error ? error.message : "حدث خطأ أثناء تفريغ الملف.");
    } finally { setTranscriptionBusy(false); }
  }

  return <><section className="audio-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">تحويل النص إلى صوت</span><h3>استوديو الصوت والتعليق</h3><p>اكتب النص الذي تريد تحويله إلى تعليق صوتي.</p></div><span><AudioLines size={22} /></span></div>
    <div className="audio-options"><label>محرك الصوت<select value={provider} onChange={(e) => setProvider(e.target.value as "elevenlabs" | "google")} disabled={busy}><option value="elevenlabs">ElevenLabs</option><option value="google">Google Gemini TTS</option></select></label>{provider === "google" && <label>الصوت<select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={busy}><option>Kore</option><option>Puck</option><option>Charon</option><option>Fenrir</option><option>Aoede</option><option>Callirrhoe</option><option>Enceladus</option><option>Orus</option><option>Zephyr</option><option>Schedar</option></select></label>}</div>
    <label className="image-prompt-label">النص الصوتي<textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="اكتب النص بالعربية أو اللغة التي تريدها..." /></label>
    <button className="image-generate-btn" onClick={() => void generate()} disabled={busy || !text.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Mic2 size={17} />}{busy ? "جارٍ إنشاء الصوت..." : "إنشاء التعليق الصوتي"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    {audio && <div className="audio-result"><audio controls src={audio} /><a href={audio} download={provider === "google" ? "nexora-voiceover.wav" : "nexora-voiceover.mp3"}><Download size={16} /> تنزيل الملف الصوتي</a></div>}
    <p className="image-studio-foot">يعمل عبر ElevenLabs أو Gemini TTS عند ربط المفاتيح اللازمة. الأصوات مولّدة بالذكاء الاصطناعي، وتختلف النبرة واللغات بحسب النموذج والصوت المختار.</p>
  </section><section className="audio-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">تحويل الكلام إلى نص</span><h3>تفريغ الصوت والفيديو</h3><p>ارفع تسجيلاً صوتياً أو فيديو لاستخراج الكلام المكتوب.</p></div><span><AudioLines size={22} /></span></div>
    <div className="audio-options"><label>محرك التفريغ<select value={transcriptionProvider} onChange={(e) => setTranscriptionProvider(e.target.value as "deepgram" | "assemblyai")} disabled={transcriptionBusy}><option value="deepgram">Deepgram Nova 3</option><option value="assemblyai">AssemblyAI Universal</option></select></label></div>
    <label className="image-prompt-label">ملف صوت أو فيديو<input type="file" accept="audio/*,video/*" onChange={(e) => setTranscriptionFile(e.target.files?.[0] || null)} disabled={transcriptionBusy} /></label>
    <button className="image-generate-btn" onClick={() => void transcribe()} disabled={transcriptionBusy || !transcriptionFile}>{transcriptionBusy ? <LoaderCircle size={17} className="spin" /> : <Mic2 size={17} />}{transcriptionBusy ? "جارٍ تفريغ الملف..." : "تفريغ إلى نص"}</button>
    {transcriptionNotice && <p className="image-studio-notice" role="status">{transcriptionNotice}</p>}
    {transcription && <label className="image-prompt-label">النص المستخرج<textarea value={transcription} readOnly rows={8} /></label>}
    <p className="image-studio-foot">الحد الأقصى للرفع 25 ميغابايت. قد تُحتسب رسوم لدى Deepgram أو AssemblyAI حسب طول الملف وخطة حسابك.</p>
  </section><MusicStudio /></>;
}
