export const dynamic = "force-dynamic";

async function currentUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return await response.json() as { id: string; email?: string };
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email) return Response.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  const admins = (process.env.NEXORA_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) return Response.json({ error: "هذه الصفحة مخصصة للمسؤولين فقط." }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return Response.json({ error: "إعداد المفتاح الإداري للخادم غير مكتمل." }, { status: 503 });
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
  try {
    const [usersResponse, profilesResponse, subscriptionsResponse, jobsResponse, limitsResponse] = await Promise.all([
      fetch(url + "/auth/v1/admin/users?page=1&per_page=100", { headers, cache: "no-store" }),
      fetch(url + "/rest/v1/profiles?select=id,display_name,created_at&order=created_at.desc&limit=100", { headers, cache: "no-store" }),
      fetch(url + "/rest/v1/subscriptions?select=owner_id,plan,status,current_period_end", { headers, cache: "no-store" }),
      fetch(url + "/rest/v1/generation_jobs?select=id,owner_id,service_type,status,created_at&order=created_at.desc&limit=100", { headers, cache: "no-store" }),
      fetch(url + "/rest/v1/plan_limits?select=plan,service_type,daily_generation_limit&order=plan.asc,service_type.asc", { headers, cache: "no-store" })
    ]);
    if (![usersResponse, profilesResponse, subscriptionsResponse, jobsResponse].every((response) => response.ok)) {
      return Response.json({ error: "تعذر تحميل بيانات لوحة الإدارة. تحقق من صلاحيات المفتاح الإداري." }, { status: 502 });
    }
    const [usersData, profiles, subscriptions, jobs, limits] = await Promise.all([
      usersResponse.json(), profilesResponse.json(), subscriptionsResponse.json(), jobsResponse.json(), limitsResponse.ok ? limitsResponse.json() : Promise.resolve([])
    ]);
    const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    const subByOwner = new Map((subscriptions || []).map((subscription: any) => [subscription.owner_id, subscription]));
    const users = (usersData.users || []).map((account: any) => {
      const profile: any = profileById.get(account.id);
      const subscription: any = subByOwner.get(account.id);
      return {
        id: account.id,
        email: account.email || "—",
        displayName: profile?.display_name || "—",
        createdAt: account.created_at,
        plan: subscription?.plan || "free",
        subscriptionStatus: subscription?.status || "—"
      };
    });
    return Response.json({
      counts: {
        users: usersData.total ?? users.length,
        jobs: (jobs || []).length,
        completedJobs: (jobs || []).filter((job: any) => job.status === "completed").length,
        activeSubscriptions: (subscriptions || []).filter((item: any) => item.status === "active" && item.plan !== "free").length
      },
      users,
      jobs: jobs || [],
      limits: limits || []
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء تحميل لوحة الإدارة." }, { status: 500 });
  }
}
