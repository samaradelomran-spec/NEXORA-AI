"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2, Gamepad2, Clapperboard, Film, LoaderCircle, Save, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Studio = "web" | "games" | "cinema" | "series";
const config: Record<Studio, { title: string; promptLabel: string; placeholder: string; projectType: string; icon: typeof Code2 }> = {
  web: { title: "استوديو المواقع والتطبيقات", promptLabel: "وصف الموقع أو التطبيق", placeholder: "صف الموقع أو التطبيق الذي تريد بناءه، الصفحات والوظائف والتصميم...", projectType: "web", icon: Code2 },
  games: { title: "استوديو الألعاب", promptLabel: "فكرة اللعبة", placeholder: "صف نوع اللعبة والعالم والشخصيات وطريقة اللعب والمنصات...", projectType: "game", icon: Gamepad2 },
  cinema: { title: "استوديو السينما والأفلام", promptLabel: "فكرة الفيلم", placeholder: "اكتب فكرة الفيلم والشخصيات والجو والمدة والمشاهد المطلوبة...", projectType: "film", icon: Clapperboard },
  series: { title: "استوديو المسلسلات", promptLabel: "فكرة المسلسل", placeholder: "صف عالم المسلسل والشخصيات وعدد الحلقات ونوع الدراما...", projectType: "series", icon: Film }
};

export default function CreativeStudio({ studio }: { studio: Studio }) {
  const item = config[studio];
  const Icon = item.icon;
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);

  async function generate() {
    if (!prompt.trim() || busy) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setNotice("إعداد Supabase غير موجود بعد."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setNotice("سجّل الدخول أولاً لاستخدام الاستوديو."); return; }
    setBusy(true); setNotice(""); setResult(""); setSaved(false);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ provider, studio, messages: [{ role: "user", content: prompt }] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء المحتوى.");
      setResult(data.answer);
      setNotice("تم إنشاء المحتوى. راجعه ثم احفظه كمشروع.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء الإنشاء.");
    } finally { setBusy(false); }
  }

  async function saveProject() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !result) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotice("سجّل الدخول لحفظ المشروع."); return; }
    setSaving(true); setNotice("");
    const { error } = await supabase.from("projects").insert({
      owner_id: user.id,
      name: item.title + " — " + new Date().toLocaleDateString("ar"),
      description: prompt.slice(0, 500),
      project_type: item.projectType,
      content: { prompt, result, provider }
    });
    if (error) setNotice("تعذر حفظ المشروع: " + error.message);
    else { setSaved(true); setNotice("تم حفظ النتيجة ضمن مشاريع حسابك."); }
    setSaving(false);
  }

  return <section className="creative-studio-panel">
    <div className="image-studio-head"><div><span className="section-kicker">إنشاء بمساعدة الذكاء الاصطناعي</span><h3>{item.title}</h3><p>اكتب الفكرة، اختر المحرك، ثم أنشئ مسودة مفصلة قابلة للحفظ.</p></div><span><Icon size={22} /></span></div>
    <label className="image-prompt-label">{item.promptLabel}<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder={item.placeholder} /></label>
    <div className="creative-controls"><label>محرك الذكاء الاصطناعي<select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)} disabled={busy}><option value="openai">OpenAI</option><option value="anthropic">Claude</option><option value="google">Gemini</option></select></label><span>يلزم ربط مفتاح المحرك المختار</span></div>
    <button className="image-generate-btn" onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{busy ? "جارٍ إنشاء المحتوى..." : "إنشاء المحتوى"}</button>
    {notice && <p className="image-studio-notice" role="status">{notice}</p>}
    {result && <div className="creative-result"><div className="creative-result-head"><b>النتيجة</b><button onClick={() => void saveProject()} disabled={saving || saved}>{saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}{saved ? "تم الحفظ" : "حفظ كمشروع"}</button></div><pre>{result}</pre>{saved && <Link href="/projects">عرض مشاريعي</Link>}</div>}
    <p className="image-studio-foot">ينشئ هذا الاستوديو محتوى وخططاً ونماذج أولية نصية. إنشاء ملفات قابلة للتشغيل أو نشرها يحتاج خطوات إضافية.</p>
  </section>;
}
