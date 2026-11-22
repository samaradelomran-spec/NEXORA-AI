"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, File as FileIcon, FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type StoredFile = { name: string; signedUrl: string; createdAt?: string | null; size?: number; contentType?: string };

export default function FilesPage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = getSupabaseBrowserClient();

  const loadFiles = useCallback(async (uid?: string) => {
    if (!supabase) { setLoading(false); return; }
    const id = uid || userId;
    if (!id) { setLoading(false); return; }
    const { data, error } = await supabase.storage.from("nexora-files").list(id + "/uploads", {
      limit: 50, sortBy: { column: "created_at", order: "desc" }
    });
    if (error) { setMessage("تعذر فتح التخزين السحابي. تأكد من إنشاء bucket باسم nexora-files وتطبيق سياسات التخزين."); setLoading(false); return; }
    const entries = (data || []).filter((item) => item.name && item.name !== ".emptyFolderPlaceholder");
    const mapped = await Promise.all(entries.map(async (item) => {
      const path = id + "/uploads/" + item.name;
      const { data: signed } = await supabase.storage.from("nexora-files").createSignedUrl(path, 3600);
      return { name: item.name, signedUrl: signed?.signedUrl || "", createdAt: item.created_at, size: item.metadata?.size, contentType: item.metadata?.mimetype };
    }));
    setFiles(mapped);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    async function init() {
      if (!supabase) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      await loadFiles(user.id);
    }
    void init();
  }, [supabase, loadFiles]);

  async function upload(file?: File) {
    if (!file || !supabase || !userId) return;
    if (file.size > 100 * 1024 * 1024) { setMessage("حجم الملف أكبر من الحد المسموح (100 ميغابايت)."); return; }
    setUploading(true); setMessage("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const path = userId + "/uploads/" + Date.now() + "-" + safeName;
    const { error } = await supabase.storage.from("nexora-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) setMessage("تعذر رفع الملف: " + error.message);
    else { setMessage("تم رفع الملف وحفظه في التخزين السحابي."); await loadFiles(userId); }
    setUploading(false);
  }

  async function removeFile(name: string) {
    if (!supabase || !userId || !window.confirm("هل تريد حذف هذا الملف؟")) return;
    const { error } = await supabase.storage.from("nexora-files").remove([userId + "/uploads/" + name]);
    if (error) setMessage("تعذر حذف الملف: " + error.message);
    else { setMessage("تم حذف الملف."); await loadFiles(userId); }
  }

  return <main className="portal-shell">
    <header className="portal-top"><Link href="/" className="portal-back"><ArrowLeft size={16} /> العودة لمساحة العمل</Link><span className="portal-brand">NEXORA <b>AI</b></span></header>
    <section className="portal-content">
      <div className="portal-heading"><div><span className="section-kicker">ملفاتك الخاصة</span><h1>التخزين السحابي</h1><p>ارفع ملفات مشاريعك واحتفظ بها داخل مساحة حسابك.</p></div><span className="portal-heading-icon"><FileIcon size={25} /></span></div>
      {!supabase && <div className="engine-notice"><FileIcon size={18} /><div><b>Supabase غير مُعد</b><p>يلزم إعداد الاتصال وقاعدة التخزين.</p></div></div>}
      {supabase && !userId && !loading && <div className="engine-notice"><File size={18} /><div><b>سجّل الدخول أولاً</b><p>الملفات محفوظة بشكل خاص لكل حساب.</p><Link href="/login" className="projects-login-link">تسجيل الدخول</Link></div></div>}
      <label className="file-upload-box"><input type="file" accept="image/*,video/mp4,video/webm,audio/mpeg,audio/wav,audio/mp4,application/pdf" disabled={!userId || uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.currentTarget.value = ""; }} /><span>{uploading ? <LoaderCircle size={22} className="spin" /> : <FileUp size={22} />}</span><b>{uploading ? "جارٍ رفع الملف..." : "اضغط لاختيار ملف ورفعه"}</b><small>صور، فيديو، صوت أو PDF · الحد الأقصى 100 ميغابايت</small></label>
      {message && <p className="project-message">{message}</p>}
      <div className="project-list-heading"><h2>ملفاتي</h2><span>{files.length} ملف</span></div>
      {loading ? <p className="project-empty">جارٍ تحميل الملفات...</p> : files.length ? <div className="stored-file-list">{files.map((item) => <article className="stored-file" key={item.name}><span><File size={18} /></span><div><b>{item.name}</b><small>{item.contentType || "ملف"} · {item.size ? Math.round(item.size / 1024) + " KB" : "—"}</small></div><div className="stored-file-actions">{item.signedUrl && <a href={item.signedUrl} target="_blank" rel="noreferrer" aria-label="تنزيل الملف"><Download size={16} /></a>}<button onClick={() => void removeFile(item.name)} aria-label="حذف الملف"><Trash2 size={16} /></button></div></article>)}</div> : <div className="project-empty"><FileIcon size={28} /><b>لا توجد ملفات محفوظة</b><span>ارفع أول ملف ليظهر هنا.</span></div>}
    </section>
  </main>;
}
