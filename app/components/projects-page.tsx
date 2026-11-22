"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, FolderKanban, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Project = { id: string; name: string; description: string | null; project_type: string; created_at: string; updated_at: string; content?: { source?: string; studio?: string; title?: string; prompt?: string; resolution?: string } | null };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [openProject, setOpenProject] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  const loadProjects = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setUserId(null); setLoading(false); return; }
    setUserId(user.id);
    const { data, error } = await supabase.from("projects").select("id,name,description,project_type,created_at,updated_at,content").order("updated_at", { ascending: false });
    if (error) setMessage("تعذر تحميل المشاريع: " + error.message);
    else setProjects((data || []) as Project[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId || !name.trim()) return;
    setSaving(true); setMessage("");
    const { data, error } = await supabase.from("projects").insert({
      owner_id: userId, name: name.trim(), description: description.trim(),
      project_type: type, content: {}
    }).select("id,name,description,project_type,created_at,updated_at,content").single();
    if (error) setMessage("لم يتم حفظ المشروع: " + error.message);
    else { setProjects((current) => [data as Project, ...current]); setName(""); setDescription(""); setType("general"); setMessage("تم حفظ المشروع في قاعدة البيانات السحابية."); }
    setSaving(false);
  }

  async function deleteProject(id: string) {
    if (!supabase || !window.confirm("هل تريد حذف هذا المشروع؟")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) setMessage("تعذر حذف المشروع: " + error.message);
    else { setProjects((current) => current.filter((project) => project.id !== id)); setMessage("تم حذف المشروع."); }
  }

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">مساحة ملفاتك</span><h1>مشاريعي</h1><p>أنشئ مشاريعك ونظّمها واحفظها في قاعدة بيانات حسابك.</p></div><span className="portal-heading-icon"><FolderKanban size={25} /></span></div>
      {!supabase && <div className="engine-notice"><FolderKanban size={19} /><div><b>الاتصال السحابي غير مُعد</b><p>أضف إعدادات Supabase في بيئة التشغيل حتى تتمكن من حفظ المشاريع بحسابك. لن تُحفظ هذه البيانات سحابياً قبل ذلك.</p></div></div>}
      {supabase && !userId && !loading && <div className="engine-notice"><FolderKanban size={19} /><div><b>سجّل الدخول أولاً</b><p>تحتاج إلى حساب للدخول إلى مشاريعك الخاصة.</p><Link href="/login" className="projects-login-link">الانتقال إلى تسجيل الدخول</Link></div></div>}
      <form className="project-create" onSubmit={createProject}>
        <h2><Plus size={18} /> مشروع جديد</h2>
        <div className="project-form-grid"><label>اسم المشروع<input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: متجري الإلكتروني" required disabled={!userId} /></label><label>نوع المشروع<select value={type} onChange={(e) => setType(e.target.value)} disabled={!userId}><option value="general">عام</option><option value="web">موقع أو تطبيق</option><option value="game">لعبة</option><option value="image">صور وتصميم</option><option value="video">فيديو أو فيلم</option><option value="audio">صوت</option></select></label></div>
        <label className="project-description">وصف مختصر<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ما فكرة هذا المشروع؟" disabled={!userId} /></label>
        <button className="project-submit" type="submit" disabled={!userId || saving || !name.trim()}>{saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}{saving ? "جارٍ الحفظ..." : "حفظ المشروع"}</button>
      </form>
      {message && <p className="project-message" role="status">{message}</p>}
      <div className="project-list-heading"><h2>كل المشاريع</h2><span>{projects.length} مشروع</span></div>
      {loading ? <p className="project-empty">جارٍ تحميل المشاريع...</p> : projects.length ? <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}><div className="project-card-top"><span><FolderKanban size={19} /></span><button onClick={() => void deleteProject(project.id)} aria-label="حذف المشروع"><Trash2 size={16} /></button></div><h3>{project.name}</h3><p>{project.description || "لا يوجد وصف لهذا المشروع بعد."}</p><small>{project.project_type} · {new Date(project.updated_at).toLocaleDateString("ar")}</small>{project.content?.prompt && <button className="project-submit" type="button" onClick={() => setOpenProject(openProject === project.id ? null : project.id)}><Eye size={15} />{openProject === project.id ? "إخفاء المسودة" : "عرض المسودة"}</button>}{openProject === project.id && project.content?.prompt && <div className="project-draft-detail"><b>{project.content.title || "تفاصيل المسودة"}</b><p>{project.content.prompt}</p>{project.content.resolution && <small>الدقة المستهدفة: {project.content.resolution}</small>}</div>}</article>)}</div> : <div className="project-empty"><FolderKanban size={28} /><b>لا توجد مشاريع محفوظة بعد</b><span>أنشئ أول مشروع لك من النموذج أعلاه.</span></div>}
    </section>
  </main>;
}
