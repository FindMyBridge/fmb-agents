import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from './types';

interface Store extends RequestContext {
  externalLatencySamples: number[];
}

const storage = new AsyncLocalStorage<Store>();

export function runWithTelemetryContext<T>(ctx: RequestContext, fn: () => T): T {
  const store: Store = { ...ctx, externalLatencySamples: [] };
  return storage.run(store, fn);
}

export function getRequestContext(): RequestContext | null {
  const s = storage.getStore();
  if (!s) return null;
  return {
    userAgent: s.userAgent,
    mcpClientName: s.mcpClientName,
    mcpClientVersion: s.mcpClientVersion,
    ipHash: s.ipHash,
    uaHash: s.uaHash,
    requestId: s.requestId,
  };
}

/**
 * Sites that make external network calls (Iris, RPC) call this with each
 * round-trip's wall time. No-op if outside a telemetry context (e.g. tests,
 * `TELEMETRY_ENABLED=false`, or non-MCP code paths).
 */
export function recordExternalLatencyMs(ms: number): void {
  const s = storage.getStore();
  if (!s) return;
  if (!Number.isFinite(ms) || ms < 0) return;
  s.externalLatencySamples.push(Math.round(ms));
}

/**
 * Sum of all reported external latencies in the current request. Returns null
 * when nothing was reported — that becomes a NULL column in `mcp_events`,
 * which is distinct from "tool ran in 0ms externally".
 */
export function getAccumulatedExternalLatencyMs(): number | null {
  const s = storage.getStore();
  if (!s || s.externalLatencySamples.length === 0) return null;
  return s.externalLatencySamples.reduce((a, b) => a + b, 0);
}
