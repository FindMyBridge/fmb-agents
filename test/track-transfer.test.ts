import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '@/lib/mcp/server';

const BURN_TX = '0xf7c2c5ae77517fb4b10545709e6907f0a25a30d0c8e1466001c27f8b3435c5c5';
const ATTESTATION = '0xcc1d8705270ba621e1a9e98e7f3617f80467b0952e980fb3aa9b2e3430020898';
const NONCE = '0xfae7e613a58fc0621e1f2fc1e81191d8d6607424981ff7434491fe9be4277388';

const IRIS_PENDING = {
  messages: [
    { message: '0x', attestation: '0x', eventNonce: NONCE, status: 'pending_confirmations' },
  ],
};
const IRIS_COMPLETE = {
  messages: [
    { message: '0x000000010000000300000006', attestation: ATTESTATION, eventNonce: NONCE, status: 'complete' },
  ],
};

function rpcOk(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function mockFetch(
  handler: (url: string, body: Record<string, unknown> | null) => unknown,
): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null;
    const response = handler(url, body);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

interface TransferStatusResponse {
  trackingId: string;
  stage: 'pending' | 'attested' | 'completed' | 'failed';
  source: string;
  destination: string;
  burnTxHash: string;
  attestation?: string;
  mintTxHash?: string;
  updatedAt: string;
}

describe('track_transfer', () => {
  let client: Client;

  beforeAll(async () => {
    process.env.NETWORK = 'testnet';
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(serverTransport);
    client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function track(args: Record<string, string>): Promise<TransferStatusResponse> {
    const result = await client.callTool({ name: 'track_transfer', arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    if (result.isError) throw new Error(`tool error: ${content?.[0]?.text ?? '(none)'}`);
    return JSON.parse(content[0].text) as TransferStatusResponse;
  }

  it('returns stage=pending when Iris reports pending_confirmations', async () => {
    mockFetch((url) => {
      if (url.includes('iris-api')) return IRIS_PENDING;
      throw new Error(`unexpected fetch: ${url}`);
    });

    const status = await track({
      trackingId: 'fmb_test',
      source: 'arbitrum',
      destination: 'base',
      burnTxHash: BURN_TX,
    });

    expect(status.stage).toBe('pending');
    expect(status.attestation).toBeUndefined();
    expect(status.mintTxHash).toBeUndefined();
    expect(status.burnTxHash).toBe(BURN_TX);
  });

  it('returns stage=attested when Iris is complete but usedNonces==0', async () => {
    mockFetch((url, body) => {
      if (url.includes('iris-api')) return IRIS_COMPLETE;
      const method = body?.method as string;
      if (method === 'eth_call') return rpcOk(body?.id, '0x' + '0'.repeat(64));
      throw new Error(`unexpected RPC method: ${method}`);
    });

    const status = await track({
      trackingId: 'fmb_test',
      source: 'arbitrum',
      destination: 'base',
      burnTxHash: BURN_TX,
    });

    expect(status.stage).toBe('attested');
    expect(status.attestation).toBe(ATTESTATION);
    expect(status.mintTxHash).toBeUndefined();
  });

  it('returns stage=completed when usedNonces!=0 (mintTxHash best-effort)', async () => {
    mockFetch((url, body) => {
      if (url.includes('iris-api')) return IRIS_COMPLETE;
      const method = body?.method as string;
      if (method === 'eth_call') return rpcOk(body?.id, '0x' + '0'.repeat(63) + '1');
      if (method === 'eth_blockNumber') return rpcOk(body?.id, '0xf4240'); // 1,000,000
      if (method === 'eth_getLogs') return rpcOk(body?.id, []); // no logs found -> mintTxHash stays undefined
      throw new Error(`unexpected RPC method: ${method}`);
    });

    const status = await track({
      trackingId: 'fmb_test',
      source: 'arbitrum',
      destination: 'base',
      burnTxHash: BURN_TX,
    });

    expect(status.stage).toBe('completed');
    expect(status.attestation).toBe(ATTESTATION);
    expect(status.mintTxHash).toBeUndefined();
  });
});
