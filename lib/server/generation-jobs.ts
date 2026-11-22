type UsageArgs = { url: string; anon: string; token: string; ownerId: string; serviceType: string };

const fallbackLimits: Record<string, { free: number; pro: number }> = {
  assistant: { free: 10, pro: 40 },
  web: { free: 3, pro: 15 },
  games: { free: 3, pro: 15 },
  cinema: { free: 3, pro: 15 },
  series: { free: 3, pro: 15 },
  image: { free: 1, pro: 2 },
  video: { free: 1, pro: 1 },
  audio: { free: 2, pro: 5 },
  music: { free: 1, pro: 1 },
  sound_effect: { free: 2, pro: 5 }
};

export async function checkDailyGenerationLimit(args: UsageArgs): Promise<
  { allowed: true; used: number; limit: number; plan: "free" | "pro" } |
  { allowed: false; used: number; limit: number; plan: "free" | "pro"; reason: "limit" | "database" }
> {
  const headers = { apikey: args.anon, Authorization: "Bearer " + args.token };
  try {
    const identityResponse = await fetch(args.url + "/auth/v1/user", { headers, cache: "no-store" });
    if (identityResponse.ok) {
      const identity = await identityResponse.json() as { email?: string };
      const admins = (process.env.NEXORA_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
      if (identity.email && admins.includes(identity.email.toLowerCase())) {
        return { allowed: true, used: 0, limit: Number.MAX_SAFE_INTEGER, plan: "pro" };
      }
    }
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
      args.url + "/rest/v1/plan_limits?plan=eq." + plan + "&service_type=eq." + encodeURIComponent(args.serviceType) + "&select=daily_generation_limit&limit=1",
      { headers, cache: "no-store" }
    );
    const fallback = fallbackLimits[args.serviceType] || fallbackLimits.assistant;
    let limit = fallback[plan];
    if (limitsResponse.ok) {
      const rows = await limitsResponse.json();
      const configuredLimit = Number(rows?.[0]?.daily_generation_limit);
      if (Number.isFinite(configuredLimit) && configuredLimit >= 0) limit = configuredLimit;
    }

    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const query = "?owner_id=eq." + args.ownerId +
      "&service_type=eq." + encodeURIComponent(args.serviceType) +
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
    const fallback = fallbackLimits[args.serviceType] || fallbackLimits.assistant;
    return { allowed: false, used: 0, limit: fallback.free, plan: "free", reason: "database" };
  }
}
