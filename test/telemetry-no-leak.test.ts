import { describe, it, expect } from 'vitest';
import { sha256Truncated } from '@/lib/telemetry/hash';
import { serializeEvent } from '@/lib/telemetry/normalize';
import type { RequestContext } from '@/lib/telemetry/types';

// Adversarial fixtures — real-shape values that MUST NEVER leak into a row.
const WALLET = '0x46aD5e560e843cF5Ffb22c8423048142547D8210';
const RECIPIENT = '0xDEADBEEFcAfEbAbE0000000000000000000F00d1';
const AMOUNT_EXACT = '1234.567890';
const BURN_TX = '0xe276a1bc05b1fd043c85361bc0c65c8255edc8e0fbf4092ad66548cb7fa99fb5';
const RAW_IP = '192.168.1.42';
const IRIS_URL = `https://iris-api-sandbox.circle.com/v2/messages/3/${BURN_TX}`;

function baseCtx(ip = RAW_IP, ua = 'curl/8.4.0'): RequestContext {
  return {
    userAgent: ua,
    mcpClientName: null,
    mcpClientVersion: null,
    // The route hashes the IP before storage; we mirror that here.
    ipHash: sha256Truncated(ip, 32),
    uaHash: sha256Truncated(ua, 32),
    requestId: '11111111-1111-1111-1111-111111111111',
  };
}

function assertNoLeak(row: object, sensitive: string[]): void {
  const serialized = JSON.stringify(row);
  for (const s of sensitive) {
    expect(serialized).not.toContain(s);
  }
}

describe('telemetry no-leak', () => {
  it('base case — wallet, amount, and tx hash in input must not appear in event', () => {
    const row = serializeEvent({
      tool: 'prepare_transfer',
      input: {
        source: 'arbitrum',
        destination: 'base',
        amount: AMOUNT_EXACT,
        recipient: RECIPIENT,
        sender: WALLET,
        maxFee: '0.01',
        minFinalityThreshold: 1000,
      },
      ctx: baseCtx(),
      startedAt: new Date('2026-05-18T10:00:00Z'),
      latencyMs: 42,
      externalLatencyMs: null,
      status: 'ok',
      err: null,
    });

    assertNoLeak(row, [WALLET, WALLET.toLowerCase(), RECIPIENT, RECIPIENT.toLowerCase(), AMOUNT_EXACT, '567890']);
    expect(row.amount_bucket).toBe('1k-10k');
    expect(row.source_chain_id).not.toBeNull();
    expect(row.dest_chain_id).not.toBeNull();
  });

  it('case (a) — X-Forwarded-For IP must not appear in serialized event', () => {
    const row = serializeEvent({
      tool: 'get_supported_routes',
      input: {},
      ctx: baseCtx(RAW_IP, 'curl/8.4.0'),
      startedAt: new Date('2026-05-18T10:00:00Z'),
      latencyMs: 5,
      externalLatencyMs: null,
      status: 'ok',
      err: null,
    });

    assertNoLeak(row, [RAW_IP, '192.168', '1.42']);
    // session_id is opaque hex, not the IP — sanity check.
    expect(row.session_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('case (b) — throw with Iris URL + tx hash must only leak error_code from the closed taxonomy', () => {
    const err = new Error(`iris fetch failed: ${IRIS_URL}`);
    const row = serializeEvent({
      tool: 'prepare_mint',
      input: {
        source: 'arbitrum',
        destination: 'base',
        burnTxHash: BURN_TX,
      },
      ctx: baseCtx(),
      startedAt: new Date('2026-05-18T10:00:00Z'),
      latencyMs: 230,
      externalLatencyMs: 220,
      status: 'server_error',
      err,
    });

    // The closed taxonomy must catch this — not internal_error catch-all.
    expect(row.error_code).toBe('external_api_error');
    expect(row.status).toBe('server_error');
    // The URL, host, and tx hash must not be anywhere in the row.
    assertNoLeak(row, [
      IRIS_URL,
      'iris-api-sandbox',
      'circle.com',
      BURN_TX,
      BURN_TX.slice(2, 10),
      'iris fetch failed',
    ]);
    // burn_tx_hash_present is the boolean signal — proves we know it was given
    // without persisting the value.
    expect(row.burn_tx_hash_present).toBe(true);
  });

  it('unsupported chain in input is reported as 0, not the raw key', () => {
    const row = serializeEvent({
      tool: 'get_supported_routes',
      input: { source: 'solana-mainnet-beta', destination: 'base' },
      ctx: baseCtx(),
      startedAt: new Date('2026-05-18T10:00:00Z'),
      latencyMs: 3,
      externalLatencyMs: null,
      status: 'ok',
      err: null,
    });

    expect(row.source_chain_id).toBe(0);
    expect(row.dest_chain_id).not.toBe(0);
    assertNoLeak(row, ['solana-mainnet-beta', 'solana']);
  });

  it('user-agent content does not leak — only its hash and the client_class', () => {
    const ua = `Mozilla/5.0 (very-identifying-suffix-${WALLET})`;
    const row = serializeEvent({
      tool: 'get_supported_routes',
      input: {},
      ctx: baseCtx(RAW_IP, ua),
      startedAt: new Date('2026-05-18T10:00:00Z'),
      latencyMs: 2,
      externalLatencyMs: null,
      status: 'ok',
      err: null,
    });

    assertNoLeak(row, [ua, 'very-identifying-suffix', WALLET]);
    expect(row.client_class).toBe('browser');
    expect(row.client_raw_ua_hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
