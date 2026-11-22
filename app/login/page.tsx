"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = Boolean(getSupabaseBrowserClient());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("الاتصال بقاعدة البيانات غير مُعد بعد. أضف رابط Supabase والمفتاح العام في متغيرات البيئة.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        setMessage("تم إرسال طلب إنشاء الحساب. افحص بريدك لتأكيده إذا كان تأكيد البريد مفعّلاً.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("تم تسجيل الدخول بنجاح. يمكنك العودة إلى مساحة العمل.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="auth-back"><ArrowRight size={17} /> العودة إلى NEXORA</Link>
        <div className="auth-brand"><span><Sparkles size={24} /></span><b>NEXORA <i>AI</i></b></div>
        <p className="auth-kicker">مساحة إبداعك تبدأ من هنا</p>
        <h1>{mode === "login" ? "أهلاً بعودتك" : "أنشئ حسابك"}</h1>
        <p className="auth-subtitle">{mode === "login" ? "سجّل الدخول للعودة إلى مشاريعك." : "أنشئ حساباً للبدء بحفظ مشاريعك."}</p>
        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>تسجيل الدخول</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>حساب جديد</button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label><span><Mail size={15} /> البريد الإلكتروني</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
          <label><span><LockKeyhole size={15} /> كلمة المرور</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 أحرف على الأقل" /></label>
          {mode === "login" && <button className="auth-reset" type="button" onClick={() => void handlePasswordReset()} disabled={busy}>نسيت كلمة المرور؟</button>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "يرجى الانتظار..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        <p className="auth-status">{configured ? "إعداد Supabase موجود في بيئة التشغيل." : "واجهة الحسابات جاهزة، وينتظر تفعيل الاتصال بقاعدة البيانات."}</p>
        <p className="auth-foot">لن نطلب منك مشاركة كلمة المرور أو مفاتيح الاتصال هنا.</p>
      </section>
    </main>
  );
}
