import { z } from 'zod';
import type { Hex } from 'viem';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prepareMint } from '@/lib/rails/cctp/prepare-mint';
import { withTelemetry } from '@/lib/telemetry/middleware';

const chainKeyEnum = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'optimism',
  'polygon',
  'avalanche',
]);

export function registerPrepareMint(server: McpServer): void {
  server.registerTool(
    'prepare_mint',
    {
      title: 'Prepare the unsigned mint (CCTP V2 receiveMessage)',
      description:
        'Builds the unsigned `receiveMessage` transaction that completes a CCTP V2 transfer on the destination chain. Polls Circle\'s Iris API for the attestation. Returns `status: "pending"` (with the Iris status and any delay reason) when the attestation is not yet ready, and `status: "ready"` (with `{ to, data, value, chainId, nonce }`) once it is. Non-custodial — the caller signs and broadcasts the returned tx on the destination chain.',
      inputSchema: {
        source: chainKeyEnum.describe('Source chain key (where the burn happened)'),
        destination: chainKeyEnum.describe('Destination chain key (where the mint will land)'),
        burnTxHash: z
          .string()
          .describe('The source-chain tx hash of the confirmed depositForBurn (0x...)'),
      },
    },
    withTelemetry('prepare_mint', async ({ source, destination, burnTxHash }) => {
      if (source === destination) {
        throw new Error('source and destination must differ');
      }
      const prepared = await prepareMint({
        source,
        destination,
        burnTxHash: burnTxHash as Hex,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(prepared, null, 2) }],
      };
    }),
  );
}
