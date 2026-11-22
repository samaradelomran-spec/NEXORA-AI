type UsageArgs = { url: string; anon: string; token: string; ownerId: string };

export async function checkDailyGenerationLimit(args: UsageArgs): Promise<
  { allowed: true; used: number; limit: number; plan: "free" | "pro" } |
  { allowed: false; used: number; limit: number; plan: "free" | "pro"; reason: "limit" | "database" }
> {
  const headers = { apikey: args.anon, Authorization: "Bearer " + args.token };
  try {
    const subscriptionResponse = await fetch(
      args.url + "/rest/v1/subscriptions?owner_id=eq." + args.ownerId + "&select=plan,status&limit=1",
      { headers, cache: "no-store" }
    );
    let plan: "free" | "pro" = "free";
    if (subscriptionResponse.ok) {
      const subscriptions = await subscriptionResponse.json();
      if (subscriptions?.[0]?.plan === "pro" && ["active", "trialing"].includes(subscriptions[0].status)) plan = "pro";
    }

    const limitsResponse = await fetch(
      args.url + "/rest/v1/plan_limits?plan=eq." + plan + "&select=daily_generation_limit&limit=1",
      { headers, cache: "no-store" }
    );
    let limit = plan === "pro" ? 100 : 10;
    if (limitsResponse.ok) {
      const rows = await limitsResponse.json();
      const configuredLimit = Number(rows?.[0]?.daily_generation_limit);
      if (Number.isFinite(configuredLimit) && configuredLimit > 0) limit = configuredLimit;
    }
    const envLimit = Number(process.env[plan === "pro" ? "NEXORA_PRO_DAILY_LIMIT" : "NEXORA_FREE_DAILY_LIMIT"]);
    if (Number.isFinite(envLimit) && envLimit > 0) limit = envLimit;

    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const query = "?owner_id=eq." + args.ownerId +
      "&created_at=gte." + encodeURIComponent(midnight.toISOString()) +
      "&status=in.(processing,queued,completed)&select=id";
    const countResponse = await fetch(args.url + "/rest/v1/generation_jobs" + query, {
      method: "HEAD",
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
      cache: "no-store"
    });
    if (!countResponse.ok) return { allowed: false, used: 0, limit, plan, reason: "database" };
    const contentRange = countResponse.headers.get("content-range") || "";
    const totalText = contentRange.split("/")[1];
    const used = totalText && totalText !== "*" ? Number(totalText) : 0;
    if (!Number.isFinite(used)) return { allowed: false, used: 0, limit, plan, reason: "database" };
    return used >= limit
      ? { allowed: false, used, limit, plan, reason: "limit" }
      : { allowed: true, used, limit, plan };
  } catch {
    return { allowed: false, used: 0, limit: 10, plan: "free", reason: "database" };
  }
}
