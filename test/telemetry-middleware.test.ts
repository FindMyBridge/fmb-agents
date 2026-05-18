import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordExternalLatencyMs, runWithTelemetryContext } from '@/lib/telemetry/context';
import { withTelemetry } from '@/lib/telemetry/middleware';
import * as supabaseModule from '@/lib/telemetry/supabase';
import type { McpEventRow, RequestContext } from '@/lib/telemetry/types';

function ctx(): RequestContext {
  return {
    userAgent: 'curl/8.4.0',
    mcpClientName: null,
    mcpClientVersion: null,
    ipHash: 'a'.repeat(32),
    uaHash: 'b'.repeat(32),
    requestId: '11111111-1111-1111-1111-111111111111',
  };
}

const ORIGINAL_FLAG = process.env.TELEMETRY_ENABLED;

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.TELEMETRY_ENABLED;
  else process.env.TELEMETRY_ENABLED = ORIGINAL_FLAG;
  vi.restoreAllMocks();
});

describe('withTelemetry — feature flag off', () => {
  it('returns the handler unchanged when TELEMETRY_ENABLED is not "true"', () => {
    delete process.env.TELEMETRY_ENABLED;
    const handler = async (args: Record<string, unknown>) => args;
    expect(withTelemetry('quote_transfer', handler)).toBe(handler);
  });

  it('never calls insertEvent when off, even inside a context', async () => {
    delete process.env.TELEMETRY_ENABLED;
    const spy = vi.spyOn(supabaseModule, 'insertEvent').mockResolvedValue();
    const handler = async () => 'ok';
    const wrapped = withTelemetry('get_supported_routes', handler);
    await runWithTelemetryContext(ctx(), () => wrapped({}));
    await new Promise((r) => setImmediate(r));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('withTelemetry — wrap path', () => {
  beforeEach(() => {
    process.env.TELEMETRY_ENABLED = 'true';
  });

  it('captures the row on success with status ok and accumulated external latency', async () => {
    let captured: McpEventRow | null = null;
    vi.spyOn(supabaseModule, 'insertEvent').mockImplementation(async (row) => {
      captured = row;
    });

    const handler = async () => {
      recordExternalLatencyMs(80);
      recordExternalLatencyMs(40);
      return 'done';
    };
    const wrapped = withTelemetry('prepare_mint', handler);
    const result = await runWithTelemetryContext(ctx(), () =>
      wrapped({ source: 'arbitrum', destination: 'base', burnTxHash: '0xabc' }),
    );
    expect(result).toBe('done');
    await new Promise((r) => setImmediate(r));

    expect(captured).not.toBeNull();
    const c = captured as unknown as McpEventRow;
    expect(c.tool).toBe('prepare_mint');
    expect(c.status).toBe('ok');
    expect(c.error_code).toBeNull();
    expect(c.external_latency_ms).toBe(120);
    expect(c.burn_tx_hash_present).toBe(true);
    expect(c.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('on throw — re-throws to caller AND captures server_error row with classified code', async () => {
    let captured: McpEventRow | null = null;
    vi.spyOn(supabaseModule, 'insertEvent').mockImplementation(async (row) => {
      captured = row;
    });

    const wrapped = withTelemetry('prepare_mint', async () => {
      throw new Error('Iris 503 Service Unavailable for https://iris-api-sandbox.circle.com/v2/messages/3/0xdeadbeef');
    });

    await expect(
      runWithTelemetryContext(ctx(), () => wrapped({ source: 'arbitrum', destination: 'base', burnTxHash: '0xdeadbeef' })),
    ).rejects.toThrow(/Iris 503/);
    await new Promise((r) => setImmediate(r));

    expect(captured).not.toBeNull();
    const c = captured as unknown as McpEventRow;
    expect(c.status).toBe('server_error');
    expect(c.error_code).toBe('iris_unavailable');
  });

  it('sink down — handler still returns normally to the caller when insertEvent throws', async () => {
    vi.spyOn(supabaseModule, 'insertEvent').mockRejectedValue(new Error('supabase down'));
    const handler = async () => 'still-here';
    const wrapped = withTelemetry('quote_transfer', handler);

    const result = await runWithTelemetryContext(ctx(), () =>
      wrapped({ source: 'arbitrum', destination: 'base', amount: '10' }),
    );
    expect(result).toBe('still-here');
    // No throw to the caller even though the sink is broken.
  });

  it('no-bloqueo — latency overhead with wrapper is small versus bare handler', async () => {
    vi.spyOn(supabaseModule, 'insertEvent').mockResolvedValue();
    const RUNS = 50;
    const work = async (): Promise<void> => {
      // ~5ms of synthetic work — representative of a real tool handler.
      await new Promise((r) => setTimeout(r, 5));
    };

    delete process.env.TELEMETRY_ENABLED;
    const bare = withTelemetry('get_supported_routes', work);

    process.env.TELEMETRY_ENABLED = 'true';
    const wrapped = withTelemetry('get_supported_routes', work);

    let bareTotal = 0;
    for (let i = 0; i < RUNS; i++) {
      const t = performance.now();
      await bare({});
      bareTotal += performance.now() - t;
    }

    let wrappedTotal = 0;
    for (let i = 0; i < RUNS; i++) {
      const t = performance.now();
      await runWithTelemetryContext(ctx(), () => wrapped({}));
      wrappedTotal += performance.now() - t;
    }

    const bareAvg = bareTotal / RUNS;
    const wrappedAvg = wrappedTotal / RUNS;
    const overhead = (wrappedAvg - bareAvg) / bareAvg;
    // Spec §9 — wrapped path must be within ~5% of bare path. 10% is the
    // CI-safe headroom; locally this comes in well under 5%.
    expect(overhead).toBeLessThan(0.10);
  });
});
