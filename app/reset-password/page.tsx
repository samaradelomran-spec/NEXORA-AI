"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirm) { setMessage("كلمتا المرور غير متطابقتين."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("إعداد Supabase غير موجود."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.");
    setBusy(false);
  }

  return <main className="auth-shell"><section className="auth-card">
    <Link href="/login" className="auth-back"><ArrowRight size={17} /> العودة إلى تسجيل الدخول</Link>
    <div className="auth-brand"><span><Sparkles size={24} /></span><b>NEXORA <i>AI</i></b></div>
    <p className="auth-kicker">أمان حسابك</p><h1>تعيين كلمة مرور جديدة</h1>
    <p className="auth-subtitle">اكتب كلمة المرور الجديدة ثم أكدها.</p>
    <form className="auth-form" onSubmit={submit}>
      <label><span><LockKeyhole size={15} /> كلمة المرور الجديدة</span><input type="password" minLength={6} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label><span><LockKeyhole size={15} /> تأكيد كلمة المرور</span><input type="password" minLength={6} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ التحديث..." : "تحديث كلمة المرور"}</button>
    </form>
    {message && <p className="auth-message" role="status">{message}</p>}
  </section></main>;
}
