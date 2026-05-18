import { describe, it, expect } from 'vitest';
import { classifyClient } from '@/lib/telemetry/client-class';
import { classifyError } from '@/lib/telemetry/error-codes';
import { bucketAmount, buildSessionId, buildClientRawUaHash } from '@/lib/telemetry/normalize';
import type { RequestContext } from '@/lib/telemetry/types';

describe('classifyClient', () => {
  it('detects claude_desktop via MCP client header', () => {
    expect(classifyClient(null, 'claude-ai')).toBe('claude_desktop');
    expect(classifyClient('Claude/Desktop/1.0', null)).toBe('claude_desktop');
  });

  it('detects claude_code', () => {
    expect(classifyClient(null, 'claude-code')).toBe('claude_code');
    expect(classifyClient('Claude-Code/2.0', null)).toBe('claude_code');
  });

  it('detects cursor', () => {
    expect(classifyClient('Cursor/0.42.0', null)).toBe('cursor');
  });

  it('detects curl/dev tools', () => {
    expect(classifyClient('curl/8.4.0', null)).toBe('curl_or_dev_tool');
    expect(classifyClient('PostmanRuntime/7.36.0', null)).toBe('curl_or_dev_tool');
    expect(classifyClient('node-fetch/3', null)).toBe('curl_or_dev_tool');
  });

  it('detects browsers', () => {
    expect(
      classifyClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        null,
      ),
    ).toBe('browser');
  });

  it('falls back to unknown', () => {
    expect(classifyClient('SomeRandomBot/1.0', null)).toBe('unknown');
    expect(classifyClient(null, null)).toBe('unknown');
    expect(classifyClient('', null)).toBe('unknown');
  });
});

describe('bucketAmount', () => {
  it('handles null/undefined/empty', () => {
    expect(bucketAmount(null)).toBeNull();
    expect(bucketAmount(undefined)).toBeNull();
    expect(bucketAmount('')).toBeNull();
  });

  it('handles negative and NaN', () => {
    expect(bucketAmount(-5)).toBeNull();
    expect(bucketAmount('abc')).toBeNull();
  });

  it('buckets correctly across the scale', () => {
    expect(bucketAmount('0.5')).toBe('<1');
    expect(bucketAmount('1')).toBe('1-10');
    expect(bucketAmount('9.99')).toBe('1-10');
    expect(bucketAmount('10')).toBe('10-100');
    expect(bucketAmount('99.5')).toBe('10-100');
    expect(bucketAmount('100')).toBe('100-1k');
    expect(bucketAmount('999')).toBe('100-1k');
    expect(bucketAmount('1000')).toBe('1k-10k');
    expect(bucketAmount('9999.99')).toBe('1k-10k');
    expect(bucketAmount('10000')).toBe('10k-100k');
    expect(bucketAmount('99999')).toBe('10k-100k');
    expect(bucketAmount('100000')).toBe('>100k');
    expect(bucketAmount('1000000')).toBe('>100k');
  });

  it('accepts numbers and bigint-like strings', () => {
    expect(bucketAmount(42)).toBe('10-100');
    expect(bucketAmount('1234.5678')).toBe('1k-10k');
  });
});

describe('classifyError', () => {
  it('maps invalid_address from prepare_transfer messages', () => {
    expect(classifyError(new Error('Invalid recipient address: 0xnotvalid'))).toEqual({
      code: 'invalid_address',
      status: 'client_error',
    });
    expect(classifyError(new Error('Invalid sender address: 0xbad'))).toEqual({
      code: 'invalid_address',
      status: 'client_error',
    });
  });

  it('maps invalid_amount', () => {
    expect(classifyError(new Error('Invalid USDC amount "1.2.3"'))).toEqual({
      code: 'invalid_amount',
      status: 'client_error',
    });
  });

  it('maps unsupported_route', () => {
    expect(classifyError(new Error('source and destination must differ'))).toEqual({
      code: 'unsupported_route',
      status: 'client_error',
    });
    expect(
      classifyError(new Error('No fee tiers available for arbitrum → base on testnet')),
    ).toEqual({ code: 'unsupported_route', status: 'client_error' });
  });

  it('maps invalid_chain', () => {
    expect(classifyError(new Error('Unknown chain "solana" on testnet'))).toEqual({
      code: 'invalid_chain',
      status: 'client_error',
    });
  });

  it('maps iris_unavailable on 5xx', () => {
    expect(
      classifyError(new Error('Iris 503 Service Unavailable for https://iris/...')),
    ).toEqual({ code: 'iris_unavailable', status: 'server_error' });
  });

  it('maps generic Iris errors to external_api_error', () => {
    expect(
      classifyError(new Error('Iris 404 Not Found for https://iris-api-sandbox.circle.com/foo')),
    ).toEqual({ code: 'external_api_error', status: 'server_error' });
  });

  it('falls back to internal_error', () => {
    expect(classifyError(new Error('something blew up'))).toEqual({
      code: 'internal_error',
      status: 'server_error',
    });
    expect(classifyError('a plain string thrown')).toEqual({
      code: 'internal_error',
      status: 'server_error',
    });
  });
});

describe('hashed identity helpers', () => {
  const ctx: RequestContext = {
    userAgent: 'curl/8.4.0',
    mcpClientName: null,
    mcpClientVersion: null,
    ipHash: 'a'.repeat(32),
    uaHash: 'b'.repeat(32),
    requestId: '11111111-1111-1111-1111-111111111111',
  };

  it('client_raw_ua_hash is stable, 16 hex chars, and not the UA itself', () => {
    const hash = buildClientRawUaHash(ctx);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hash).not.toContain('curl');
    expect(buildClientRawUaHash(ctx)).toBe(hash);
  });

  it('session_id rotates across day buckets', () => {
    const day1 = new Date(Date.UTC(2026, 4, 1, 12));
    const day2 = new Date(Date.UTC(2026, 4, 2, 12));
    const s1 = buildSessionId(ctx.ipHash, ctx.uaHash, day1);
    const s2 = buildSessionId(ctx.ipHash, ctx.uaHash, day2);
    expect(s1).not.toBe(s2);
  });

  it('same caller on same day yields same session_id', () => {
    const noon = new Date(Date.UTC(2026, 4, 1, 12));
    const lateNight = new Date(Date.UTC(2026, 4, 1, 23, 59));
    expect(buildSessionId(ctx.ipHash, ctx.uaHash, noon)).toBe(
      buildSessionId(ctx.ipHash, ctx.uaHash, lateNight),
    );
  });
});
