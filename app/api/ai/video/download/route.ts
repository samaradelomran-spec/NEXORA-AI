async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) return null;
  return { user: await response.json() as { id: string }, token, url, anon };
}

export async function GET(request: Request) {
  const auth = await getUser(request);
  if (!auth) return Response.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ error: "معرّف المهمة غير صالح." }, { status: 400 });

  try {
    const lookup = await fetch(auth.url + "/rest/v1/generation_jobs?id=eq." + jobId + "&owner_id=eq." + auth.user.id + "&select=result&limit=1", {
      headers: { apikey: auth.anon, Authorization: "Bearer " + auth.token }, cache: "no-store"
    });
    if (!lookup.ok) return Response.json({ error: "تعذر قراءة المهمة." }, { status: 502 });
    const rows = await lookup.json();
    const job = rows?.[0];
    const videoUrl = job?.result?.video_url;
    if (!videoUrl) return Response.json({ error: "لا يوجد رابط فيديو لهذه المهمة." }, { status: 404 });

    const parsed = new URL(videoUrl);
    const allowedHosts = ["storage.googleapis.com", "fal.media", "runwayml.com", "runwayml.ai", "lumalabs.ai", "amazonaws.com", "cloudfront.net"];
    if (parsed.protocol !== "https:" || !allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith("." + host))) {
      return Response.json({ error: "رابط الفيديو من مضيف غير معتمد." }, { status: 400 });
    }

    const upstream = await fetch(parsed.toString(), { cache: "no-store", signal: AbortSignal.timeout(90000) });
    if (!upstream.ok || !upstream.body) return Response.json({ error: "تعذر تنزيل الفيديو من المحرك." }, { status: 502 });
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "video/mp4",
      "Cache-Control": "private, no-store"
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return Response.json({ error: "حدث خطأ أثناء تنزيل الفيديو." }, { status: 500 });
  }
}
