export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "nexora-ai",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
