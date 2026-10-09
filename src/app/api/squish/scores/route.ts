import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Leaderboard for PXL RUNNER, the footer easter egg (public/squish-run).
 * The game calls this route so it never holds Supabase credentials. Writes go through the
 * submit_squish_score() database function, which validates the name, rejects impossible
 * scores and rate-limits each visitor (identified by a hash of their IP, never the IP itself).
 * Only this server can call that function: it uses SUPABASE_SECRET_KEY, a server-only
 * environment variable, so nobody can post scores around this route.
 */
export const dynamic = "force-dynamic";

function supabase(key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const { data, error } = await supabase()
    .from("squish_scores")
    .select("name, best")
    .order("best", { ascending: false })
    .limit(10);

  if (error) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ scores: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ accepted: false, reason: "invalid" }, { status: 400 });
  }

  const { name, score, runMs } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !Number.isInteger(score) || !Number.isInteger(runMs)) {
    return Response.json({ accepted: false, reason: "invalid" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const client = ip
    ? createHash("sha256").update(`squish-run:${ip}`).digest("hex").slice(0, 32)
    : null;

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return Response.json({ accepted: false, reason: "unavailable" }, { status: 503 });

  const { data, error } = await supabase(secret).rpc("submit_squish_score", {
    p_name: name.slice(0, 40),
    p_score: score,
    p_run_ms: runMs,
    p_client: client,
  });

  if (error) return Response.json({ accepted: false, reason: "unavailable" }, { status: 503 });

  const row = (Array.isArray(data) ? data[0] : data) as
    | { accepted: boolean; reason: string; best: number | null }
    | undefined;
  if (!row) return Response.json({ accepted: false, reason: "unavailable" }, { status: 503 });

  const status = row.accepted ? 200 : row.reason === "slow" ? 429 : 422;
  return Response.json(row, { status });
}
