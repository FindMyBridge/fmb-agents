import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { McpEventRow } from './types';

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'fmb-agents-mcp' } },
  });
  return cached;
}

export function isTelemetryEnabled(): boolean {
  return process.env.TELEMETRY_ENABLED === 'true';
}

export function sampleRate(): number {
  const raw = process.env.SAMPLE_RATE?.trim();
  if (!raw) return 1.0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 1.0;
  if (n > 1) return 1.0;
  return n;
}

/**
 * Best-effort insert. Errors are caught and logged to stderr (Vercel captures
 * them) but never re-thrown — the response to the MCP client is independent
 * of the telemetry sink's availability. No retries on the hot path (spec §5).
 */
export async function insertEvent(row: McpEventRow): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.error('[telemetry] supabase client unavailable, dropping event');
    return;
  }
  const { error } = await client.from('mcp_events').insert(row);
  if (error) {
    console.error('[telemetry] insert failed', error.message);
  }
}
