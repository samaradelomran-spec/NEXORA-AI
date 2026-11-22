"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, CreditCard, LoaderCircle, ShieldCheck, Users } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type AdminData = {
  counts: { users: number; jobs: number; completedJobs: number; activeSubscriptions: number };
  users: { id: string; email: string; displayName: string; createdAt: string; plan: string; subscriptionStatus: string }[];
  jobs: { id: string; owner_id: string; service_type: string; status: string; created_at: string }[];
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setError("إعداد Supabase غير موجود."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError("سجّل الدخول بحساب المسؤول."); setLoading(false); return; }
      try {
        const response = await fetch("/api/admin/overview", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل لوحة الإدارة.");
        setData(result as AdminData);
      } catch (err) { setError(err instanceof Error ? err.message : "حدث خطأ."); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">إدارة المنصة</span><h1>لوحة الإدارة</h1><p>نظرة عامة على الحسابات والاشتراكات وعمليات التوليد.</p></div><span className="portal-heading-icon"><ShieldCheck size={25} /></span></div>
      {loading && <p className="project-empty"><LoaderCircle size={20} className="spin" /> جارٍ تحميل لوحة الإدارة...</p>}
      {error && <div className="engine-notice"><ShieldCheck size={18} /><div><b>تعذر فتح لوحة الإدارة</b><p>{error} لإتاحة حساب مسؤول، أضف بريده إلى NEXORA_ADMIN_EMAILS ومفتاح SUPABASE_SERVICE_ROLE_KEY إلى متغيرات الخادم فقط.</p></div></div>}
      {data && <>
        <div className="admin-stat-grid"><div><Users size={18} /><strong>{data.counts.users}</strong><span>المستخدمون</span></div><div><CreditCard size={18} /><strong>{data.counts.activeSubscriptions}</strong><span>اشتراكات مدفوعة نشطة</span></div><div><Activity size={18} /><strong>{data.counts.jobs}</strong><span>عمليات مسجلة</span></div><div><ShieldCheck size={18} /><strong>{data.counts.completedJobs}</strong><span>عمليات مكتملة</span></div></div>
        <section className="settings-section"><h2><Users size={18} /> المستخدمون</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>البريد</th><th>الاسم</th><th>الخطة</th><th>الحالة</th><th>تاريخ التسجيل</th></tr></thead><tbody>{data.users.map((account) => <tr key={account.id}><td>{account.email}</td><td>{account.displayName}</td><td>{account.plan}</td><td>{account.subscriptionStatus}</td><td>{new Date(account.createdAt).toLocaleDateString("ar")}</td></tr>)}</tbody></table></div></section>
        <section className="settings-section"><h2><Activity size={18} /> آخر العمليات</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>النوع</th><th>الحالة</th><th>معرّف المستخدم</th><th>التاريخ</th></tr></thead><tbody>{data.jobs.slice(0,30).map((job) => <tr key={job.id}><td>{job.service_type}</td><td>{job.status}</td><td>{job.owner_id.slice(0,8)}…</td><td>{new Date(job.created_at).toLocaleString("ar")}</td></tr>)}</tbody></table></div></section>
      </>}
    </section>
  </main>;
}
