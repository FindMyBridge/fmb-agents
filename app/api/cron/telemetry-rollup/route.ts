import { getSupabaseClient } from '@/lib/telemetry/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron entrypoint. Scheduled at 02:00 UTC in vercel.json — runs the
 * rollup for the previous UTC day into `mcp_events_daily` via the Postgres
 * function `rollup_mcp_events(DATE)`. Idempotent: re-running the same day
 * overwrites previously-computed rows.
 *
 * Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` on every
 * invocation. Reject anything else — the route is publicly addressable.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return Response.json({ error: 'supabase not configured' }, { status: 500 });
  }

  const targetDay = previousUtcDay();
  const { data, error } = await supabase.rpc('rollup_mcp_events', { target_day: targetDay });
  if (error) {
    console.error('[telemetry-rollup] rpc failed', error.message);
    return Response.json({ error: error.message, target_day: targetDay }, { status: 500 });
  }
  return Response.json({ ok: true, target_day: targetDay, rows_upserted: data });
}

function previousUtcDay(): string {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}
