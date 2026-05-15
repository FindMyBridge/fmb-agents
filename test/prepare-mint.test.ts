import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Hex } from 'viem';
import { prepareMint } from '@/lib/rails/cctp/prepare-mint';
import { encodeReceiveMessage } from '@/lib/rails/cctp/receive-message';

const BURN_TX = '0xf7c2c5ae77517fb4b10545709e6907f0a25a30d0c8e1466001c27f8b3435c5c5' as Hex;
const MESSAGE = '0x000000010000000300000006fae7e613a58fc0621e1f2fc1e81191d8d660' as Hex;
const ATTESTATION = '0xcc1d8705270ba621e1a9e98e7f3617f80467b0952e980fb3aa9b2e3430020898' as Hex;
const NONCE = '0xfae7e613a58fc0621e1f2fc1e81191d8d6607424981ff7434491fe9be4277388' as Hex;
const BASE_SEPOLIA_MSG_XMITTER = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275'.toLowerCase();

function mockIris(body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('prepareMint', () => {
  beforeEach(() => {
    process.env.NETWORK = 'testnet';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns status=pending when Iris reports pending_confirmations', async () => {
    mockIris({
      messages: [
        {
          message: '0x',
          attestation: '0x',
          eventNonce: NONCE,
          status: 'pending_confirmations',
          delayReason: null,
        },
      ],
    });

    const result = await prepareMint({
      source: 'arbitrum',
      destination: 'base',
      burnTxHash: BURN_TX,
      network: 'testnet',
    });

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') throw new Error('discriminated wrong');
    expect(result.irisStatus).toBe('pending_confirmations');
    expect(result.delayReason).toBeNull();
    expect(result.source).toBe('arbitrum');
    expect(result.destination).toBe('base');
    expect(result.burnTxHash).toBe(BURN_TX);
  });

  it('returns status=ready with encoded receiveMessage when Iris is complete', async () => {
    mockIris({
      messages: [
        {
          message: MESSAGE,
          attestation: ATTESTATION,
          eventNonce: NONCE,
          status: 'complete',
        },
      ],
    });

    const result = await prepareMint({
      source: 'arbitrum',
      destination: 'base',
      burnTxHash: BURN_TX,
      network: 'testnet',
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('discriminated wrong');
    expect(result.to.toLowerCase()).toBe(BASE_SEPOLIA_MSG_XMITTER);
    expect(result.chainId).toBe(84532);
    expect(result.value).toBe('0');
    expect(result.nonce).toBe(NONCE);
    expect(result.data).toBe(encodeReceiveMessage(MESSAGE, ATTESTATION));
  });

  it('returns status=pending when Iris returns no messages for the tx', async () => {
    mockIris({ messages: [] });

    const result = await prepareMint({
      source: 'arbitrum',
      destination: 'base',
      burnTxHash: BURN_TX,
      network: 'testnet',
    });

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') throw new Error('discriminated wrong');
    expect(result.irisStatus).toBe('not_found');
  });
});
