export const dynamic = "force-dynamic";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", {
    headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store"
  });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string; email?: string }, url, anon, token };
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return Response.json({ error: "سجّل الدخول لعرض رصيدك." }, { status: 401 });
  const admins = (process.env.NEXORA_ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const isAdmin = Boolean(auth.user.email && admins.includes(auth.user.email.toLowerCase()));
  if (isAdmin) return Response.json({ isAdmin: true, unlimited: true, balance: null, transactions: [] });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: "نظام الرصيد بانتظار إعداد المفتاح الإداري للخادم." }, { status: 503 });
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
  try {
    const [accountResponse, historyResponse] = await Promise.all([
      fetch(auth.url + "/rest/v1/credit_accounts?owner_id=eq." + auth.user.id + "&select=balance&limit=1", { headers, cache: "no-store" }),
      fetch(auth.url + "/rest/v1/credit_transactions?owner_id=eq." + auth.user.id + "&select=id,amount,transaction_type,description,created_at&order=created_at.desc&limit=20", { headers, cache: "no-store" })
    ]);
    if (!accountResponse.ok || !historyResponse.ok) return Response.json({ error: "طبّق ترحيل نظام الرصيد في Supabase أولاً." }, { status: 503 });
    const [accounts, transactions] = await Promise.all([accountResponse.json(), historyResponse.json()]);
    return Response.json({ isAdmin: false, unlimited: false, balance: Number(accounts?.[0]?.balance || 0), transactions });
  } catch {
    return Response.json({ error: "تعذر تحميل رصيد الحساب." }, { status: 502 });
  }
}
