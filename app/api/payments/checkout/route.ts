async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return await response.json() as { id: string; email?: string };
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user?.email) return Response.json({ error: "سجّل الدخول قبل الاشتراك." }, { status: 401 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anon) {
    try {
      const current = await fetch(supabaseUrl + "/rest/v1/subscriptions?owner_id=eq." + user.id + "&select=plan,status&limit=1", {
        headers: { apikey: anon, Authorization: request.headers.get("authorization") || "" },
        cache: "no-store"
      });
      if (!current.ok) return Response.json({ error: "تعذر التحقق من اشتراكك الحالي. حاول بعد قليل." }, { status: 502 });
      const rows = await current.json();
      if (rows?.[0]?.plan === "pro" && ["active", "trialing"].includes(rows[0].status)) {
        return Response.json({ error: "اشتراك Pro مفعّل بالفعل. يمكنك إدارته من صفحة الاشتراكات." }, { status: 409 });
      }
    } catch {
      return Response.json({ error: "تعذر التحقق من اشتراكك الحالي." }, { status: 503 });
    }
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!secret || !price) return Response.json({ error: "بوابة الدفع غير مفعّلة بعد. يلزم إعداد حساب Stripe ومعرّف سعر Pro." }, { status: 503 });

  try {
    const origin = new URL(request.url).origin;
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("line_items[0][price]", price);
    form.set("line_items[0][quantity]", "1");
    form.set("client_reference_id", user.id);
    form.set("customer_email", user.email);
    form.set("success_url", origin + "/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}");
    form.set("cancel_url", origin + "/pricing?checkout=cancelled");
    form.set("subscription_data[metadata][owner_id]", user.id);
    form.set("subscription_data[metadata][plan]", "pro");
    form.set("allow_promotion_codes", "true");

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || !data.url) return Response.json({ error: "تعذر إنشاء صفحة الدفع. تحقق من إعداد منتج Pro ومعرّف السعر في Stripe." }, { status: 502 });
    return Response.json({ url: data.url });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء تجهيز عملية الاشتراك." }, { status: 500 });
  }
}
