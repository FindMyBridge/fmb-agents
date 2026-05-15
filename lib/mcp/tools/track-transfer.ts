import { z } from 'zod';
import { createPublicClient, http, type Hex } from 'viem';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { currentNetwork, getChain } from '@/lib/chains';
import { getMessagesByTx } from '@/lib/rails/cctp/iris-client';
import { messageTransmitterV2Abi } from '@/lib/rails/cctp/receive-message';
import type { TransferStage, TransferStatus } from '@/lib/types';

const chainKeyEnum = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'optimism',
  'polygon',
  'avalanche',
]);

// How far back to scan destination logs when looking up the mint tx hash.
// 10k blocks ≈ 5-6h on most L2s — well past any normal mint window.
const MINT_LOG_LOOKBACK_BLOCKS = 10_000n;

function stageFromIrisStatus(status: string | undefined): TransferStage {
  if (status === 'complete') return 'attested';
  if (status === 'pending_confirmations') return 'pending';
  return 'pending';
}

export function registerTrackTransfer(server: McpServer): void {
  server.registerTool(
    'track_transfer',
    {
      title: 'Track the status of a cross-chain transfer',
      description:
        'Returns the real stage of a CCTP V2 transfer (pending → attested → completed). Queries Circle\'s Iris API for the attestation status and the destination chain\'s MessageTransmitterV2.usedNonces to detect when the mint has been claimed. When completed, the destination tx hash is included on a best-effort basis (log scan).',
      inputSchema: {
        trackingId: z.string().describe('Tracking ID returned by prepare_transfer'),
        source: chainKeyEnum.describe('Source chain key'),
        destination: chainKeyEnum.describe('Destination chain key'),
        burnTxHash: z
          .string()
          .describe('The source-chain tx hash of the confirmed depositForBurn (0x...)'),
      },
    },
    async ({ trackingId, source, destination, burnTxHash }) => {
      const network = currentNetwork();
      const src = getChain(source, network);
      const dst = getChain(destination, network);

      const { messages } = await getMessagesByTx(src.cctpDomain, burnTxHash, network);
      const msg = messages[0];

      let stage: TransferStage = msg ? stageFromIrisStatus(msg.status) : 'pending';
      const attestation: Hex | undefined =
        msg && stage !== 'pending' ? (msg.attestation as Hex) : undefined;
      let mintTxHash: Hex | undefined;

      if (stage === 'attested' && msg) {
        const publicClient = createPublicClient({ transport: http(dst.rpcUrl) });
        const nonce = msg.eventNonce as Hex;

        const used = await publicClient.readContract({
          address: dst.messageTransmitterV2,
          abi: messageTransmitterV2Abi,
          functionName: 'usedNonces',
          args: [nonce],
        });

        if (used > 0n) {
          stage = 'completed';

          try {
            const head = await publicClient.getBlockNumber();
            const fromBlock = head > MINT_LOG_LOOKBACK_BLOCKS ? head - MINT_LOG_LOOKBACK_BLOCKS : 0n;
            const logs = await publicClient.getLogs({
              address: dst.messageTransmitterV2,
              event: {
                type: 'event',
                name: 'MessageReceived',
                inputs: [
                  { name: 'caller', type: 'address', indexed: true },
                  { name: 'sourceDomain', type: 'uint32', indexed: false },
                  { name: 'nonce', type: 'bytes32', indexed: true },
                  { name: 'sender', type: 'bytes32', indexed: false },
                  { name: 'finalityThresholdExecuted', type: 'uint32', indexed: true },
                  { name: 'messageBody', type: 'bytes', indexed: false },
                ],
              },
              args: { nonce },
              fromBlock,
              toBlock: 'latest',
            });
            if (logs[0]) mintTxHash = logs[0].transactionHash as Hex;
          } catch {
            // Best-effort: many RPCs cap log range. Stage stays `completed` without mintTxHash.
          }
        }
      }

      const status: TransferStatus = {
        trackingId,
        stage,
        source,
        destination,
        burnTxHash: burnTxHash as Hex,
        attestation,
        mintTxHash,
        updatedAt: new Date().toISOString(),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
      };
    },
  );
}
