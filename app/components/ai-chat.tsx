"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Bot, LoaderCircle, Send, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Provider = "openai" | "anthropic" | "google";
type Message = { role: "user" | "assistant"; content: string };

export default function AIChat({ initialPrompt = "" }: { initialPrompt?: string }) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || busy) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setNotice("إعداد Supabase غير موجود بعد."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setNotice("سجّل الدخول أولاً لاستخدام المساعد."); return; }
    const next: Message[] = [...messages, { role: "user", content: value }];
    setMessages(next); setPrompt(""); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ provider, messages: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إكمال الطلب.");
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ. حاول مرة أخرى.");
    } finally { setBusy(false); }
  }

  return <section className="ai-chat-panel">
    <div className="ai-chat-head"><div><span className="section-kicker">محادثة مباشرة عبر API</span><h3>المساعد الذكي</h3></div><select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} disabled={busy}><option value="openai">OpenAI</option><option value="anthropic">Claude</option><option value="google">Gemini</option><option value="mistral">Mistral</option></select></div>
    <div className="ai-chat-messages">{messages.length === 0 ? <div className="ai-chat-empty"><Bot size={30} /><b>كيف أقدر أساعدك؟</b><span>اكتب طلبك، واختر المحرك المناسب. يلزم تسجيل الدخول وربط مفتاح المحرك.</span></div> : messages.map((message, index) => <article className={message.role === "user" ? "chat-message user-message" : "chat-message assistant-message"} key={index}><span>{message.role === "user" ? <UserRound size={16} /> : <Bot size={16} />}</span><p>{message.content}</p></article>)}
      {busy && <div className="chat-loading"><LoaderCircle size={16} /> المحرك يكتب الرد...</div>}
    </div>
    {notice && <p className="chat-notice" role="status">{notice} {notice.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</p>}
    <form className="ai-chat-form" onSubmit={send}><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="اكتب رسالتك للمساعد..." rows={2} disabled={busy} /><button type="submit" disabled={busy || !prompt.trim()} aria-label="إرسال الرسالة">{busy ? <LoaderCircle size={18} /> : <Send size={18} />}</button></form>
    <p className="ai-chat-foot">مفاتيح API تبقى على الخادم ولا تُرسل إلى المتصفح. قد تُحتسب رسوم من مزود المحرك عند تفعيل المفتاح.</p>
  </section>;
}
