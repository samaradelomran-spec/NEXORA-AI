"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Crown, History, ShieldCheck, Wallet } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Transaction = { id: string; amount: number; transaction_type: string; description: string; created_at: string };
type Balance = { isAdmin: boolean; unlimited: boolean; balance: number | null; transactions: Transaction[] };

const packages = [
  { name: "البداية", price: "$3", credits: "10", description: "للتجربة والاستخدام الخفيف" },
  { name: "المبدع", price: "$30", credits: "2,500", description: "للمشاريع المتوسطة" },
  { name: "المحترف", price: "$50", credits: "7,000", description: "للاستخدام المكثف" }
];

export default function CreditsPage() {
  const [data, setData] = useState<Balance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!session?.access_token) { setError("سجّل الدخول لعرض رصيدك."); setLoading(false); return; }
      try {
        const response = await fetch("/api/credits/balance", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل الرصيد.");
        setData(result as Balance);
      } catch (err) { setError(err instanceof Error ? err.message : "حدث خطأ."); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">رصيدك في المنصة</span><h1>النقاط والمحفظة</h1><p>تابع رصيدك وسجل كل إضافة أو خصم في حسابك.</p></div><span className="portal-heading-icon"><Wallet size={25} /></span></div>
      {loading && <p className="project-empty">جارٍ تحميل الرصيد...</p>}
      {error && <div className="engine-notice"><ShieldCheck size={18} /><div><b>تعذر عرض الرصيد</b><p>{error} تأكد من تسجيل الدخول وتطبيق ترحيل الرصيد في قاعدة البيانات.</p><Link href="/login">تسجيل الدخول</Link></div></div>}
      {data && <div className="credit-balance-card"><div><span>رصيد حسابك</span><strong>{data.unlimited ? "∞" : Number(data.balance || 0).toLocaleString("en-US")}</strong><small>{data.unlimited ? "حساب مسؤول — استخدام غير محدود" : "نقطة متاحة"}</small></div><Coins size={34} /></div>}
      <section className="settings-section"><h2><Coins size={18} /> باقات النقاط</h2><p className="admin-note">هذه باقات مقترحة. الشراء غير مفعّل بعد إلى أن نعتمد وسيلة دفع مسموحة ويمكن سحب أرباحها فعلياً من بلد إقامتك.</p><div className="credits-package-grid">{packages.map((pack) => <article className="credits-package" key={pack.name}><span>{pack.name}</span><strong>{pack.credits}</strong><small>نقطة</small><b>{pack.price}</b><p>{pack.description}</p><button type="button" disabled>الشراء غير متاح حالياً</button></article>)}</div></section>
      <section className="settings-section"><h2><History size={18} /> سجل الحركات</h2>{!data?.transactions?.length ? <p className="admin-note">لا توجد حركات رصيد مسجلة بعد.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>العملية</th><th>التفاصيل</th><th>التاريخ</th></tr></thead><tbody>{data.transactions.map((item) => <tr key={item.id}><td className={item.amount > 0 ? "credit-positive" : "credit-negative"}>{item.amount > 0 ? "+" : ""}{item.amount.toLocaleString("en-US")}</td><td>{item.description}</td><td>{new Date(item.created_at).toLocaleString("ar")}</td></tr>)}</tbody></table></div>}</section>
      <p className="pricing-footnote">حسابات المسؤولين المحددة في NEXORA_ADMIN_EMAILS تظهر برصيد غير محدود. هذا الامتياز لا يمنح المستخدمين الآخرين نقاطاً مجانية.</p>
    </section>
  </main>;
}
