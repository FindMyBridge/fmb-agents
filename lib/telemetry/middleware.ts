import { after } from 'next/server';
import { getAccumulatedExternalLatencyMs, getRequestContext } from './context';
import { serializeEvent } from './normalize';
import { insertEvent, isTelemetryEnabled, sampleRate } from './supabase';
import type { McpEventRow, ToolCallInput, ToolName } from './types';

type ToolHandler<TArgs extends ToolCallInput, TResult> = (args: TArgs) => Promise<TResult>;

/**
 * Wraps an MCP tool handler with telemetry. When `TELEMETRY_ENABLED !== 'true'`
 * this is a true no-op (returns the handler unchanged — no wrapping cost).
 *
 * On a wrapped call:
 *   - measures wall latency around the handler
 *   - reads accumulated external latency from the AsyncLocalStorage store
 *     (populated by `recordExternalLatencyMs` in iris-client + viem call sites)
 *   - on throw: classifies the error against the closed taxonomy, re-throws
 *     to the MCP transport, schedules the event after the response
 *   - on success: schedules the event after the response
 *
 * Delivery: `next/server.after()` runs the insert via Vercel's waitUntil,
 * which extends the serverless invocation lifetime until the insert settles.
 * Pre-launch we prefer this over `setImmediate` because cold scale-down
 * cannot silently drop high-value adoption events. See docs/telemetry.md.
 */
export function withTelemetry<TArgs extends ToolCallInput, TResult>(
  tool: ToolName,
  handler: ToolHandler<TArgs, TResult>,
): ToolHandler<TArgs, TResult> {
  if (!isTelemetryEnabled()) return handler;
  return async (args: TArgs): Promise<TResult> => {
    const startedAt = new Date();
    const startNs = performance.now();
    let err: unknown | null = null;
    try {
      return await handler(args);
    } catch (e) {
      err = e;
      throw e;
    } finally {
      const latencyMs = performance.now() - startNs;
      const ctx = getRequestContext();
      if (ctx) {
        const externalLatencyMs = getAccumulatedExternalLatencyMs();
        const row = serializeEvent({
          tool,
          input: args,
          ctx,
          startedAt,
          latencyMs,
          externalLatencyMs,
          status: err === null ? 'ok' : 'server_error',
          err,
        });
        scheduleInsert(row);
      } else {
        // No request context = the middleware wasn't initialized for this
        // call (e.g. tests instantiating the server directly). Skip silently.
      }
    }
  };
}

function scheduleInsert(row: McpEventRow): void {
  if (Math.random() >= sampleRate()) return;
  try {
    after(async () => {
      try {
        await insertEvent(row);
      } catch (e) {
        console.error('[telemetry] after() insert threw', e);
      }
    });
  } catch (e) {
    // `after()` throws if called outside a request scope (e.g. tests). Fall
    // back to a fire-and-forget so the test still observes the side effect.
    void insertEvent(row).catch((err) => console.error('[telemetry] fallback insert threw', err));
    if (!(e instanceof Error) || !e.message.includes('after')) {
      console.error('[telemetry] after() scheduling threw', e);
    }
  }
}
