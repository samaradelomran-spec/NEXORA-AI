"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Image as ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("2K");
  const [provider, setProvider] = useState<"openai" | "google" | "stability">("openai");
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
        body: JSON.stringify({ prompt, resolution, provider })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الصورة.");
      const preview = `data:${data.mimeType};base64,${data.image}`;
      setImage(preview);
      const bytes = Uint8Array.from(atob(data.image), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.mimeType });
      const path = session.user.id + "/uploads/" + Date.now() + "-generated-image.png";
      const { error: storageError } = await supabase.storage.from("nexora-files").upload(path, blob, { contentType: data.mimeType, upsert: false });
      if (storageError) {
        setNotice(`تم إنشاء الصورة بدقة مستهدفة ${data.resolution}، لكن التخزين السحابي لم يُفعّل بعد. ${data.model}`);
      } else {
        const { data: signed } = await supabase.storage.from("nexora-files").createSignedUrl(path, 3600);
        if (signed?.signedUrl) setImage(signed.signedUrl);
        setNotice(`تم إنشاء الصورة عبر المحرك المختار وحفظ نسخة منها سحابياً. الدقة المستهدفة أو الافتراضية: ${data.resolution}.`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الصورة.");
    } finally { setBusy(false); }
  }

  return <section className="image-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">توليد صور مباشر</span><h3>استوديو الصور</h3><p>اكتب وصف الصورة وحدد الدقة المستهدفة.</p></div><span><ImageIcon size={22} /></span></div>
    <div className="image-engine-select"><label>محرك الصور<select value={provider} onChange={(e) => setProvider(e.target.value as "openai" | "google" | "stability")} disabled={busy}><option value="google">Google Gemini Image</option><option value="openai">OpenAI Images</option><option value="stability">Stability AI</option></select></label></div>
    {provider === "stability" && <p className="image-engine-note">Stability AI يستخدم الدقة الافتراضية للنموذج؛ لا يضمن إخراج 2K أو 4K. اختر Gemini أو OpenAI عند الحاجة إلى دقة أعلى.</p>}
    <label className="image-prompt-label">وصف الصورة<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="مثال: مشهد سينمائي لمدينة مستقبلية عند الغروب، إضاءة واقعية وتفاصيل دقيقة..." /></label>
    <div className="image-studio-controls"><label>الدقة المستهدفة<select value={resolution} onChange={(e) => setResolution(e.target.value)}><option value="2K">2K — مستهدف</option><option value="4K">4K — مستهدف حسب النموذج</option><option value="1080p">وضع قياسي — 1K</option></select></label><span>اختر Gemini أو OpenAI. 2K و4K حسب دعم النموذج المختار.</span></div>
    <button className="image-generate-btn" onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{busy ? "جارٍ إنشاء الصورة..." : "إنشاء الصورة"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    {image && <div className="image-result"><img src={image} alt="الصورة التي تم إنشاؤها" /><a href={image} download="nexora-generated-image.png"><Download size={16} /> تنزيل الصورة</a></div>}
    <p className="image-studio-foot">الدقة تعتمد على دعم نموذج الصور وحساب المزود. قد تختلف الدقة المتاحة والتكلفة حسب المحرك. Gemini 3.1 Flash Image يدعم أحجام 2K و4K وفق وثائق Google؛ و4K لدى OpenAI قد تكون تجريبية بحسب النموذج.</p>
  </section>;
}
