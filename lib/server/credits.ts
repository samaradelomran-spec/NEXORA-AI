import { randomUUID } from "node:crypto";

type CreditArgs = {
  url: string;
  ownerId: string;
  email?: string;
  amount: number;
  description: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

type CreditResult = { ok: true; balance?: number; unlimited?: boolean } | { ok: false; status: 402 | 503; error: string };

export const CREDIT_COSTS = {
  assistant: 45,
  coding: 45,
  games: 45,
  website: 660,
  app: 570,
  software: 880,
  image: 110,
  video: 155,
  audio: 130,
  music: 130,
  sound_effect: 130,
  transcription: 130,
  cinema: 1320,
  series: 3080,
  series_4k: 4400
} as const;

export function studioCreditCost(studio: string): number {
  const aliases: Record<string, keyof typeof CREDIT_COSTS> = {
    web: "website",
    apps: "app",
    programming: "coding",
    system: "software"
  };
  const key = aliases[studio] || studio;
  return CREDIT_COSTS[key as keyof typeof CREDIT_COSTS] ?? CREDIT_COSTS.assistant;
}

function isUnlimited(email?: string) {
  if (!email) return false;
  const admins = (process.env.NEXORA_ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" } : null;
}

export async function ensureCreditBalance(args: Omit<CreditArgs, "description" | "idempotencyKey" | "metadata">): Promise<CreditResult> {
  if (isUnlimited(args.email)) return { ok: true, unlimited: true };
  const headers = serviceHeaders();
  if (!headers || !args.url) return { ok: false, status: 503, error: "محفظة النقاط غير مهيأة على الخادم." };
  try {
    const response = await fetch(args.url + "/rest/v1/credit_accounts?owner_id=eq." + encodeURIComponent(args.ownerId) + "&select=balance&limit=1", {
      headers, cache: "no-store", signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return { ok: false, status: 503, error: "تعذر التحقق من رصيد النقاط. حاول لاحقاً." };
    const rows = await response.json() as Array<{ balance: number }>;
    const balance = Number(rows?.[0]?.balance || 0);
    if (balance < args.amount) return { ok: false, status: 402, error: "رصيدك غير كافٍ. تحتاج إلى " + args.amount + " نقطة لإتمام هذه العملية." };
    return { ok: true, balance };
  } catch {
    return { ok: false, status: 503, error: "تعذر الاتصال بمحفظة النقاط." };
  }
}

export async function chargeCredits(args: CreditArgs): Promise<CreditResult> {
  if (isUnlimited(args.email)) return { ok: true, unlimited: true };
  const headers = serviceHeaders();
  if (!headers || !args.url) return { ok: false, status: 503, error: "محفظة النقاط غير مهيأة على الخادم." };
  const idempotencyKey = args.idempotencyKey || "nexora-charge-" + randomUUID();
  try {
    const response = await fetch(args.url + "/rest/v1/rpc/nexora_spend_credits", {
      method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        p_owner_id: args.ownerId,
        p_amount: args.amount,
        p_description: args.description,
        p_idempotency_key: idempotencyKey,
        p_metadata: { ...(args.metadata || {}), idempotency_key: idempotencyKey }
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (/Insufficient credits/i.test(detail)) return { ok: false, status: 402, error: "رصيدك غير كافٍ لإتمام العملية." };
      return { ok: false, status: 503, error: "تعذر خصم النقاط. تأكد من تطبيق ترحيل محفظة NEXORA في Supabase." };
    }
    return { ok: true, balance: Number(await response.json()) };
  } catch {
    return { ok: false, status: 503, error: "تعذر الاتصال بمحفظة النقاط لإتمام الخصم." };
  }
}

export async function refundCredits(args: CreditArgs): Promise<CreditResult> {
  if (isUnlimited(args.email)) return { ok: true, unlimited: true };
  const headers = serviceHeaders();
  if (!headers || !args.url) return { ok: false, status: 503, error: "محفظة النقاط غير مهيأة على الخادم." };
  const idempotencyKey = "nexora-refund-" + (args.idempotencyKey || randomUUID());
  try {
    const response = await fetch(args.url + "/rest/v1/rpc/nexora_adjust_credits", {
      method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        p_owner_id: args.ownerId,
        p_amount: args.amount,
        p_description: args.description,
        p_created_by: null,
        p_transaction_type: "refund",
        p_idempotency_key: idempotencyKey,
        p_metadata: { ...(args.metadata || {}), idempotency_key: idempotencyKey }
      })
    });
    if (!response.ok) return { ok: false, status: 503, error: "تعذر إعادة النقاط إلى محفظتك تلقائياً." };
    return { ok: true, balance: Number(await response.json()) };
  } catch {
    return { ok: false, status: 503, error: "تعذر الاتصال بمحفظة النقاط لإعادة الرصيد." };
  }
}
