export const dynamic = "force-dynamic";

const configured = (name: string) => Boolean(process.env[name]?.trim());

export async function GET() {
  const providers: { id: string; name: string; keys: string[]; required?: string[] }[] = [
    { id: "openai", name: "OpenAI", keys: ["OPENAI_API_KEY"] },
    { id: "anthropic", name: "Anthropic Claude", keys: ["ANTHROPIC_API_KEY"] },
    { id: "google", name: "Google Gemini / Veo", keys: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"] },
    { id: "mistral", name: "Mistral AI", keys: ["MISTRAL_API_KEY"] },
    { id: "fal", name: "fal.ai / FLUX", keys: ["FAL_KEY"], required: ["FAL_VIDEO_MODEL"] },
    { id: "stability", name: "Stability AI", keys: ["STABILITY_API_KEY"] },
    { id: "runway", name: "Runway", keys: ["RUNWAY_API_KEY"] },
    { id: "kling", name: "Kling AI", keys: ["KLING_API_KEY"] },
    { id: "luma", name: "Luma", keys: ["LUMA_API_KEY"] },
    { id: "elevenlabs", name: "ElevenLabs", keys: ["ELEVENLABS_API_KEY"], required: ["ELEVENLABS_DEFAULT_VOICE_ID"] },
    { id: "deepgram", name: "Deepgram", keys: ["DEEPGRAM_API_KEY"] },
    { id: "assemblyai", name: "AssemblyAI", keys: ["ASSEMBLYAI_API_KEY"] }
  ].map((provider) => ({
    id: provider.id,
    name: provider.name,
    configured: provider.keys.some(configured) && (provider.required || []).every(configured)
  }));

  return Response.json({
    database: configured("NEXT_PUBLIC_SUPABASE_URL") && configured("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    admin: configured("SUPABASE_SERVICE_ROLE_KEY") && configured("NEXORA_ADMIN_EMAILS"),
    providers,
    payments: {
      stripe: configured("STRIPE_SECRET_KEY") && configured("STRIPE_WEBHOOK_SECRET")
    },
    checkedAt: new Date().toISOString()
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
