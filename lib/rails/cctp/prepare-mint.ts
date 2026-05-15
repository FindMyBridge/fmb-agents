import type { Hex } from 'viem';
import { currentNetwork, getChain } from '@/lib/chains';
import { getMessagesByTx } from '@/lib/rails/cctp/iris-client';
import { encodeReceiveMessage } from '@/lib/rails/cctp/receive-message';
import type { ChainKey, Network, PreparedMint } from '@/lib/types';

export interface PrepareMintArgs {
  source: ChainKey;
  destination: ChainKey;
  burnTxHash: Hex;
  network?: Network;
}

/**
 * Builds the unsigned `receiveMessage` transaction that completes a CCTP V2
 * transfer on the destination chain. Polls Circle's Iris API for the
 * attestation; if the attestation is not yet ready, returns a `pending` status
 * instead of a transaction. Non-custodial: this never signs.
 */
export async function prepareMint(args: PrepareMintArgs): Promise<PreparedMint> {
  const network = args.network ?? currentNetwork();
  const src = getChain(args.source, network);
  const dst = getChain(args.destination, network);

  const { messages } = await getMessagesByTx(src.cctpDomain, args.burnTxHash, network);
  const msg = messages[0];

  if (!msg) {
    return {
      rail: 'cctp-v2',
      source: args.source,
      destination: args.destination,
      burnTxHash: args.burnTxHash,
      status: 'pending',
      irisStatus: 'not_found',
      delayReason: 'No CCTP message found yet for this burn tx hash. Re-check later.',
    };
  }

  if (msg.status !== 'complete') {
    const delayReason = (msg as { delayReason?: string | null }).delayReason ?? null;
    return {
      rail: 'cctp-v2',
      source: args.source,
      destination: args.destination,
      burnTxHash: args.burnTxHash,
      status: 'pending',
      irisStatus: msg.status ?? 'unknown',
      delayReason,
    };
  }

  return {
    rail: 'cctp-v2',
    source: args.source,
    destination: args.destination,
    burnTxHash: args.burnTxHash,
    status: 'ready',
    to: dst.messageTransmitterV2,
    data: encodeReceiveMessage(msg.message as Hex, msg.attestation as Hex),
    value: '0',
    chainId: dst.chainId,
    nonce: msg.eventNonce as Hex,
  };
}
