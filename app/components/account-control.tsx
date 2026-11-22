"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function AccountControl() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) { setEmail(data.user?.email ?? null); setReady(true); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setEmail(null);
  }

  if (!ready) return <span className="account-loading">...</span>;
  if (!email) return <Link className="auth-nav-link" href="/login">تسجيل الدخول</Link>;
  return <div className="account-control"><Link href="/projects" className="account-email"><UserRound size={15} />{email}</Link><button onClick={() => void signOut()} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut size={15} /></button></div>;
}
