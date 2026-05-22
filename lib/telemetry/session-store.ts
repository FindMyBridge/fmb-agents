import { getSupabaseClient } from './supabase';
import type { ClientClass } from './types';

/**
 * Maps the `clientInfo.name` reported in the MCP `initialize` handshake to a
 * `client_class`. This is the source of truth the User-Agent never carried —
 * real MCP clients (Claude Desktop included) send no recognizable UA, so the
 * header-based classifier always fell through to `unknown`.
 *
 * Normalizes (trim + lowercase) before matching. Order matters: `claude-code`
 * is checked before the bare `claude` rule so Claude Code is not misfiled as
 * Claude Desktop. Unmapped names return `unknown` — we still persist the raw
 * name (see `recordSession`) so new clients can be discovered and mapped later.
 */
export function mapClientInfoName(name: string | null | undefined): ClientClass {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return 'unknown';
  if (n.includes('claude-code') || n.includes('claude code')) return 'claude_code';
  if (n.includes('claude')) return 'claude_desktop';
  if (n.includes('cursor')) return 'cursor';
  if (n.includes('chatgpt') || n.includes('openai')) return 'chatgpt';
  if (n.includes('agentcore') || n.includes('bedrock')) return 'agentcore';
  if (n.includes('n8n')) return 'n8n';
  if (n.includes('make') || n.includes('integromat')) return 'make';
  if (
    n.includes('inspector') ||
    n.includes('postman') ||
    n.includes('insomnia')
  ) {
    return 'curl_or_dev_tool';
  }
  return 'unknown';
}

/**
 * Precedence for the final `client_class`: a persisted `clientInfo`-derived
 * value wins, but only when it is a real classification — a persisted
 * `unknown` must not clobber a positive User-Agent match. When nothing is
 * persisted (initialize not captured, or client sent no clientInfo) we keep
 * the caller-supplied fallback (User-Agent result, itself `unknown` at worst).
 *
 * Resulting order: persisted (≠ unknown) → User-Agent → unknown.
 */
export function resolveClientClass(
  persisted: ClientClass | null,
  fallback: ClientClass,
): ClientClass {
  if (persisted !== null && persisted !== 'unknown') return persisted;
  return fallback;
}

/**
 * Fire-and-forget upsert of `{ session_id → client_class }` captured during
 * `initialize`. Best-effort: errors are logged, never thrown — a failed write
 * must not break the client handshake. The raw `clientInfo.name` is stored
 * (software name, not PII) to audit which names actually arrive.
 */
export async function recordSession(
  sessionId: string,
  clientInfoName: string | null,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.error('[telemetry] supabase client unavailable, dropping session');
    return;
  }
  const row = {
    session_id: sessionId,
    client_class: mapClientInfoName(clientInfoName),
    client_info_name: clientInfoName,
  };
  const { error } = await client
    .from('mcp_sessions')
    .upsert(row, { onConflict: 'session_id', ignoreDuplicates: true });
  if (error) {
    console.error('[telemetry] session upsert failed', error.message);
  }
}

/**
 * Resolves the persisted `client_class` for a session. Returns null when no
 * row exists (initialize not captured) or on any error — callers fall back to
 * the User-Agent classifier. A single PK lookup on `session_id`; trivial.
 */
export async function lookupClientClass(sessionId: string): Promise<ClientClass | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('mcp_sessions')
    .select('client_class')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) {
    console.error('[telemetry] session lookup failed', error.message);
    return null;
  }
  return (data?.client_class as ClientClass | undefined) ?? null;
}
