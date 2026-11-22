import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + payload, "utf8").digest("hex");
  return signatures.some((signature) => {
    try {
      const a = Buffer.from(signature, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch { return false; }
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !supabaseUrl) return Response.json({ error: "Webhook environment is not configured." }, { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(payload, signature, secret)) return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });

  try {
    const event = JSON.parse(payload);
    if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      return Response.json({ received: true });
    }
    const subscription = event.data?.object;
    const ownerId = subscription?.metadata?.owner_id;
    if (!ownerId || !subscription?.id) return Response.json({ received: true, ignored: "Missing owner metadata." });

    const cancelled = subscription.status === "canceled" || subscription.status === "incomplete_expired";
    const row = {
      owner_id: ownerId,
      plan: cancelled ? "free" : "pro",
      status: subscription.status || "unknown",
      provider: "stripe",
      provider_subscription_id: subscription.id,
      current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
    };
    const saved = await fetch(supabaseUrl + "/rest/v1/subscriptions?on_conflict=owner_id", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(row),
      cache: "no-store"
    });
    if (!saved.ok) return Response.json({ error: "Could not update subscription record." }, { status: 500 });
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
