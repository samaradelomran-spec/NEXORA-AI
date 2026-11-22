"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, CheckCircle2, Clock3, Image as ImageIcon, MessageSquare, Video } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Job = { id: string; service_type: string; prompt: string; status: string; created_at: string; result: Record<string, unknown> | null };
const labels: Record<string, string> = { assistant: "المساعد الذكي", image: "إنشاء صورة", video: "إنشاء فيديو", audio: "إنشاء صوت", web: "إنشاء موقع", game: "إنشاء لعبة" };

export default function ActivityPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const supabase = getSupabaseBrowserClient();

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase.from("generation_jobs")
      .select("id,service_type,prompt,status,created_at,result")
      .order("created_at", { ascending: false }).limit(50);
    if (error) setMessage("تعذر تحميل سجل العمليات: " + error.message);
    else setJobs((data || []) as Job[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">نشاط حسابك</span><h1>سجل العمليات</h1><p>تابع عمليات الذكاء الاصطناعي التي تم تسجيلها في حسابك.</p></div><span className="portal-heading-icon"><Activity size={25} /></span></div>
      {!supabase && <div className="engine-notice"><Activity size={18} /><div><b>قاعدة البيانات غير مُعدة</b><p>يلزم إعداد Supabase لتسجيل العمليات في الحساب.</p></div></div>}
      {supabase && !loading && jobs.length === 0 && <div className="project-empty"><Activity size={28} /><b>لا توجد عمليات بعد</b><span>عندما تستخدم محركاً متصلاً ستظهر عملياته هنا.</span></div>}
      {message && <p className="project-message">{message}</p>}
      {loading ? <p className="project-empty">جارٍ تحميل السجل...</p> : jobs.length > 0 && <div className="activity-list">{jobs.map((job) => <article className="activity-item" key={job.id}><span className="activity-icon">{job.service_type === "image" ? <ImageIcon size={18} /> : job.service_type === "video" ? <Video size={18} /> : <MessageSquare size={18} />}</span><div className="activity-body"><b>{labels[job.service_type] || job.service_type}</b><p>{job.prompt}</p><small>{new Date(job.created_at).toLocaleString("ar")}</small></div><strong className={job.status === "completed" ? "activity-done" : "activity-pending"}>{job.status === "completed" ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}{job.status === "completed" ? "مكتملة" : job.status}</strong></article>)}</div>}
    </section>
  </main>;
}
