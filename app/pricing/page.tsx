"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { ArrowLeft, Check, CreditCard, Crown, Sparkles } from "lucide-react";

const freeFeatures = ["الوصول إلى مساحة العمل الأساسية", "حفظ المشاريع في الحساب", "استخدام الأدوات بعد ربط المحركات ضمن الحدود المجانية", "دقات 2K و4K مجاناً عند دعم المحرك وحساب المزود", "إدارة المشاريع والمسودات"];
const proFeatures = ["كل مزايا الخطة المجانية", "حدود استخدام أعلى بحسب تكلفة المحركات", "أولوية في طابور المهام عند دعم المزود", "تحسين الواقعية السينمائية والتفاصيل في الصور والفيديو", "إمكانية الوصول إلى محركات إضافية عند تفعيلها"];

export default function PricingPage() {
  const [paymentReady, setPaymentReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: subscription } = await supabase.from("subscriptions").select("plan,status").maybeSingle();
      setHasPro(subscription?.plan === "pro" && ["active", "trialing"].includes(subscription.status));
    });
    void fetch("/api/system/status", { cache: "no-store" }).then((response) => response.json()).then((data) => setPaymentReady(Boolean(data.payments?.stripe))).catch(() => setPaymentReady(false));
    const query = new URLSearchParams(window.location.search);
    if (query.get("checkout") === "success") setNotice("وصلنا تأكيد العودة من صفحة الدفع. ننتظر تأكيد Stripe عبر webhook لتحديث اشتراكك.");
    if (query.get("checkout") === "cancelled") setNotice("تم إلغاء عملية الدفع. لم يتم تفعيل اشتراك Pro.");
  }, []);

  async function startCheckout() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setNotice("إعداد Supabase غير موجود."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setNotice("سجّل الدخول أولاً، ثم أعد اختيار Pro."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/payments/checkout", { method: "POST", headers: { Authorization: "Bearer " + session.access_token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر بدء الاشتراك.");
      window.location.assign(data.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء بدء الاشتراك.");
      setBusy(false);
    }
  }

  async function manageSubscription() {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!session?.access_token) { setNotice("سجّل الدخول أولاً."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/payments/portal", { method: "POST", headers: { Authorization: "Bearer " + session.access_token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر فتح إدارة الاشتراك.");
      window.location.assign(data.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : "حدث خطأ."); setBusy(false); }
  }

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">خطط تناسب إبداعك</span><h1>الخطط والاشتراكات</h1><p>ابدأ مجاناً، وانتقل إلى Pro عندما تحتاج مساحة واستخداماً أكبر.</p></div><span className="portal-heading-icon"><Crown size={25} /></span></div>
      <div className="engine-notice"><CreditCard size={19} /><div><b>{paymentReady ? "بوابة الدفع مهيأة" : "الدفع الإلكتروني بانتظار الإعداد"}</b><p>{paymentReady ? "يمكنك بدء الاشتراك من خلال صفحة Stripe الآمنة. سيتم تحديث الحالة بعد وصول تأكيد webhook." : "الأسعار والمزايا التالية هي إعداد الخطط المقترح. لن يتم خصم أي مبلغ قبل إعداد مفاتيح Stripe ومعرّف سعر Pro."}</p></div></div>
      <div className="engine-notice"><CreditCard size={19} /><div><b>تحتاج رصيداً بدلاً من الاشتراك؟</b><p>يمكنك متابعة رصيد النقاط وسجل الحركات من محفظة NEXORA.</p><Link href="/credits">فتح محفظة النقاط</Link></div></div>
      <div className="pricing-grid">
        <article className="pricing-card"><div className="pricing-label">للبداية والتجربة</div><h2>Free</h2><div className="pricing-price"><strong>$0</strong><span>/ شهرياً</span></div><p className="pricing-description">ابدأ تنظيم أفكارك ومشاريعك في NEXORA.</p><ul>{freeFeatures.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul><Link className="pricing-secondary" href="/login">إنشاء حساب مجاني</Link></article>
        <article className="pricing-card pricing-pro"><div className="pricing-popular"><Sparkles size={13} /> الخطة المتقدمة</div><div className="pricing-label">لصنّاع المحتوى والمحترفين</div><h2>Pro</h2><div className="pricing-price"><strong>$15</strong><span>/ شهرياً</span></div><p className="pricing-description">قدرات أوسع للمشاريع والاستخدام المكثف.</p><ul>{proFeatures.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>{hasPro ? <button className="pricing-primary" onClick={() => void manageSubscription()} disabled={busy}>إدارة اشتراك Pro</button> : <button className={paymentReady ? "pricing-primary" : "pricing-disabled"} onClick={() => void startCheckout()} disabled={!paymentReady || busy}>{busy ? "جارٍ تجهيز الدفع..." : paymentReady ? "الاشتراك في Pro" : "الاشتراك سيتاح بعد ربط الدفع"}</button>}</article>
      </div>
      {notice && <p className="project-message">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
      <p className="pricing-footnote">دقة 2K و4K لا تتطلب اشتراك Pro، وتتوفر فقط عندما يدعمها المحرك وحساب المزود. قد يفرض مزود المحرك رسوماً مستقلة على التوليد؛ خطة Pro تضيف تحسين الواقعية السينمائية والتفاصيل وحدود استخدام أعلى.</p>
    </section>
  </main>;
}
