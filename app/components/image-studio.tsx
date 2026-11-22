"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Image as ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("2K");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function generate() {
    if (!prompt.trim() || busy) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setNotice("إعداد Supabase غير موجود بعد."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setNotice("سجّل الدخول أولاً لإنشاء الصور."); return; }
    setBusy(true); setNotice(""); setImage("");
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt, resolution })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الصورة.");
      setImage(`data:${data.mimeType};base64,${data.image}`);
      setNotice(`تم إنشاء الصورة بدقة مستهدفة ${data.resolution}. ${data.model}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الصورة.");
    } finally { setBusy(false); }
  }

  return <section className="image-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">توليد صور مباشر</span><h3>استوديو الصور</h3><p>اكتب وصف الصورة وحدد الدقة المستهدفة.</p></div><span><ImageIcon size={22} /></span></div>
    <label className="image-prompt-label">وصف الصورة<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="مثال: مشهد سينمائي لمدينة مستقبلية عند الغروب، إضاءة واقعية وتفاصيل دقيقة..." /></label>
    <div className="image-studio-controls"><label>الدقة المستهدفة<select value={resolution} onChange={(e) => setResolution(e.target.value)}><option value="2K">2K — 2560 × 1440</option><option value="4K">4K — 3840 × 2160 (تجريبية لدى المزود)</option><option value="1080p">وضع قياسي — 1536 × 1024</option></select></label><span>المحرك: OpenAI Images</span></div>
    <button className="image-generate-btn" onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{busy ? "جارٍ إنشاء الصورة..." : "إنشاء الصورة"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    {image && <div className="image-result"><img src={image} alt="الصورة التي تم إنشاؤها" /><a href={image} download="nexora-generated-image.png"><Download size={16} /> تنزيل الصورة</a></div>}
    <p className="image-studio-foot">الدقة تعتمد على دعم نموذج الصور وحساب المزود. 4K قد تكون تجريبية وتُحتسب رسوم التوليد على حساب المزود عند ربط المفتاح.</p>
  </section>;
}
