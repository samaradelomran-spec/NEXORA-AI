"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, CreditCard, Database, KeyRound, RefreshCw, Server, ShieldCheck } from "lucide-react";

type Status = { database: boolean; admin: boolean; providers: { id: string; name: string; configured: boolean }[]; payments: { stripe: boolean }; checkedAt: string };

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/system/status", { cache: "no-store" });
      if (!response.ok) throw new Error("تعذر قراءة حالة الإعدادات.");
      setStatus(await response.json() as Status);
    } catch (err) { setError(err instanceof Error ? err.message : "حدث خطأ أثناء الفحص."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const StatusIcon = ({ ok }: { ok: boolean }) => ok ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />;

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">مركز التحكم</span><h1>الإعدادات وحالة الربط</h1><p>تابع الخدمات المتصلة من دون إظهار مفاتيحك السرية في المتصفح.</p></div><span className="portal-heading-icon"><Server size={25} /></span></div>
      <div className="settings-toolbar"><p>هذه الصفحة تعرض فقط ما إذا كان متغير الاتصال موجوداً، ولا تعرض قيمته.</p><button onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} />{loading ? "جارٍ الفحص..." : "تحديث الحالة"}</button></div>
      {error && <p className="project-message">{error}</p>}
      {loading && !status ? <p className="project-empty">جارٍ فحص إعدادات الخدمات...</p> : status && <>
        <section className="settings-section"><h2><Database size={18} /> قاعدة البيانات والحسابات</h2><div className="settings-row"><div><b>Supabase</b><span>تسجيل الدخول وقاعدة البيانات</span></div><strong className={status.database ? "settings-ok" : "settings-pending"}><StatusIcon ok={status.database} />{status.database ? "الإعداد موجود" : "بانتظار الإعداد"}</strong></div></section>
        <section className="settings-section"><h2><ShieldCheck size={18} /> لوحة الإدارة</h2><div className="settings-row"><div><b>إعداد المسؤولين</b><span>قائمة البريد والمفتاح الإداري للخادم</span></div><strong className={status.admin ? "settings-ok" : "settings-pending"}><StatusIcon ok={status.admin} />{status.admin ? "الإعداد موجود" : "بانتظار الإعداد"}</strong></div></section>
        <section className="settings-section"><h2><KeyRound size={18} /> محركات الذكاء الاصطناعي</h2><div className="settings-status-grid">{status.providers.map((provider) => <div className="settings-row" key={provider.id}><div><b>{provider.name}</b><span>مفتاح API</span></div><strong className={provider.configured ? "settings-ok" : "settings-pending"}><StatusIcon ok={provider.configured} />{provider.configured ? "المفتاح موجود" : "غير مضاف"}</strong></div>)}</div></section>
        <section className="settings-section"><h2><CreditCard size={18} /> الدفع والاشتراكات</h2><div className="settings-row"><div><b>Stripe</b><span>معالجة الاشتراكات والدفعات</span></div><strong className={status.payments.stripe ? "settings-ok" : "settings-pending"}><StatusIcon ok={status.payments.stripe} />{status.payments.stripe ? "المفاتيح موجودة" : "غير مربوط"}</strong></div><p className="settings-note">وجود المفاتيح وحده لا يعني أن الدفع جاهز؛ يلزم إعداد المنتجات والأسعار والـ webhook واختبار عملية دفع تجريبية.</p></section>
        <p className="settings-checked">آخر فحص: {new Date(status.checkedAt).toLocaleString("ar")}</p>
      </>}
      <div className="engine-notice settings-secret-note"><KeyRound size={18} /><div><b>حافظ على أمان مفاتيحك</b><p>أضف مفاتيح الخدمات لاحقاً كمتغيرات بيئة سرية في الاستضافة. لا تضعها في ملفات الواجهة أو ترسلها داخل المحادثة.</p></div></div>
    </section>
  </main>;
}
