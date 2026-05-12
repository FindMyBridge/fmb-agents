import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '@/lib/mcp/server';

interface QuoteResponse {
  rail: string;
  source: string;
  destination: string;
  asset: string;
  amountIn: string;
  amountOut: string;
  maxFee: string;
  estimatedSeconds: number;
  minFinalityThreshold: number;
  expiresAt: string;
}

describe('quote_transfer (Iris sandbox)', () => {
  let client: Client;

  beforeAll(async () => {
    process.env.NETWORK = 'testnet';
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(serverTransport);
    client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  it('returns a real quote for Arbitrum Sepolia → Base Sepolia for 100 USDC', async () => {
    const result = await client.callTool({
      name: 'quote_transfer',
      arguments: {
        source: 'arbitrum',
        destination: 'base',
        amount: '100',
        speed: 'fast',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    if (result.isError) {
      throw new Error(`tool returned isError: ${content?.[0]?.text ?? '(no content)'}`);
    }
    expect(content[0]?.type).toBe('text');

    const quote = JSON.parse(content[0].text) as QuoteResponse;
    expect(quote.rail).toBe('cctp-v2');
    expect(quote.source).toBe('arbitrum');
    expect(quote.destination).toBe('base');
    expect(quote.asset).toBe('USDC');
    expect(quote.amountIn).toMatch(/^\d+(\.\d+)?$/);
    expect(quote.amountOut).toMatch(/^\d+(\.\d+)?$/);
    expect(quote.maxFee).toMatch(/^\d+(\.\d+)?$/);
    expect(quote.estimatedSeconds).toBeTypeOf('number');
    expect(quote.minFinalityThreshold).toBeTypeOf('number');
    expect(quote.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects same source and destination', async () => {
    const result = await client.callTool({
      name: 'quote_transfer',
      arguments: {
        source: 'arbitrum',
        destination: 'arbitrum',
        amount: '10',
        speed: 'fast',
      },
    });
    expect(result.isError).toBe(true);
  });
});
