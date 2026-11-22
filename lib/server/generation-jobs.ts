type JobArgs = {
  url: string;
  anon: string;
  token: string;
  ownerId: string;
  serviceType: string;
  prompt: string;
};

export async function reserveGenerationJob(args: JobArgs): Promise<{ id: string } | { error: "limit" | "database" }> {
  try {
    const response = await fetch(args.url + "/rest/v1/rpc/reserve_generation_job", {
      method: "POST",
      headers: {
        apikey: args.anon,
        Authorization: "Bearer " + args.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_service_type: args.serviceType, p_prompt: args.prompt }),
      cache: "no-store"
    });
    if (!response.ok) {
      const detail = await response.text();
      return { error: detail.includes("DAILY_LIMIT_REACHED") ? "limit" : "database" };
    }
    const id = await response.json();
    return typeof id === "string" ? { id } : { error: "database" };
  } catch {
    return { error: "database" };
  }
}

export async function updateGenerationJob(args: {
  url: string;
  anon: string;
  token: string;
  ownerId: string;
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  result?: Record<string, unknown>;
}) {
  try {
    await fetch(args.url + "/rest/v1/generation_jobs?id=eq." + args.jobId + "&owner_id=eq." + args.ownerId, {
      method: "PATCH",
      headers: {
        apikey: args.anon,
        Authorization: "Bearer " + args.token,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        status: args.status,
        ...(args.result ? { result: args.result } : {}),
        updated_at: new Date().toISOString()
      }),
      cache: "no-store"
    });
  } catch {
    // Preserve the generated output even if history status synchronization fails.
  }
}
