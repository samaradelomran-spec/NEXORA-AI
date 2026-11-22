export const dynamic = "force-dynamic";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return await response.json() as { id: string; email?: string };
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user?.email) return Response.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  const admins = (process.env.NEXORA_ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) return Response.json({ error: "غير مصرح." }, { status: 403 });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return Response.json({ error: "إعداد الخادم غير مكتمل." }, { status: 503 });

  try {
    const body = await request.json() as { userId?: string; amount?: number; description?: string };
    if (!body.userId || !/^[0-9a-f-]{36}$/i.test(body.userId)) return Response.json({ error: "معرّف المستخدم غير صالح." }, { status: 400 });
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) return Response.json({ error: "أدخل عدداً صحيحاً بين -1,000,000 و1,000,000 باستثناء الصفر." }, { status: 400 });
    const description = String(body.description || "تعديل رصيد من لوحة الإدارة").trim().slice(0, 240);
    const response = await fetch(url + "/rest/v1/rpc/nexora_adjust_credits", {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_owner_id: body.userId, p_amount: amount, p_description: description, p_created_by: user.id, p_transaction_type: "admin_adjustment", p_metadata: { source: "admin_console" } }),
      cache: "no-store"
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return Response.json({ error: "تعذر تعديل الرصيد. تحقق من تطبيق ترحيل النظام." }, { status: 502 });
    return Response.json({ success: true, balance: result });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء تعديل الرصيد." }, { status: 500 });
  }
}
