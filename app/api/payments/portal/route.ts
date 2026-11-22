async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string }, token, url, anon };
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return Response.json({ error: "بوابة الدفع غير مهيأة." }, { status: 503 });

  try {
    const lookup = await fetch(auth.url + "/rest/v1/subscriptions?owner_id=eq." + auth.user.id + "&select=plan,status,provider_subscription_id&limit=1", {
      headers: { apikey: auth.anon, Authorization: "Bearer " + auth.token }, cache: "no-store"
    });
    if (!lookup.ok) return Response.json({ error: "تعذر قراءة اشتراكك." }, { status: 502 });
    const rows = await lookup.json();
    const subscription = rows?.[0];
    if (!subscription || subscription.plan !== "pro" || !["active", "trialing", "past_due"].includes(subscription.status) || !subscription.provider_subscription_id) {
      return Response.json({ error: "لا يوجد اشتراك Pro يمكن إدارته حالياً." }, { status: 404 });
    }

    const stripeSubscription = await fetch("https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(subscription.provider_subscription_id), {
      headers: { Authorization: "Bearer " + secret }, cache: "no-store"
    });
    const stripeData = await stripeSubscription.json();
    const customerId = typeof stripeData.customer === "string" ? stripeData.customer : stripeData.customer?.id;
    if (!stripeSubscription.ok || !customerId) return Response.json({ error: "تعذر العثور على حساب الدفع المرتبط بالاشتراك." }, { status: 502 });

    const form = new URLSearchParams({ customer: customerId, return_url: new URL(request.url).origin + "/pricing" });
    const session = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST", headers: { Authorization: "Bearer " + secret, "Content-Type": "application/x-www-form-urlencoded" },
      body: form, cache: "no-store"
    });
    const data = await session.json();
    if (!session.ok || !data.url) return Response.json({ error: "تعذر فتح بوابة إدارة الاشتراك." }, { status: 502 });
    return Response.json({ url: data.url });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء فتح إدارة الاشتراك." }, { status: 500 });
  }
}
