import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TransferStatus, TransferStage } from '@/lib/types';

const chainKeyEnum = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'optimism',
  'polygon',
  'avalanche',
]);

function stageFromAge(seconds: number): TransferStage {
  if (seconds < 15) return 'pending';
  if (seconds < 60) return 'attested';
  return 'completed';
}

export function registerTrackTransfer(server: McpServer): void {
  server.registerTool(
    'track_transfer',
    {
      title: 'Track the status of a cross-chain transfer',
      description:
        'Returns the current stage of a CCTP V2 transfer: pending → attested → completed. Phase 1 stub: stage advances based on tracking-id age so demos look realistic. Phase 2 will query Iris /v2/messages directly.',
      inputSchema: {
        trackingId: z.string().describe('Tracking ID returned by prepare_transfer'),
        source: chainKeyEnum.describe('Source chain key'),
        destination: chainKeyEnum.describe('Destination chain key'),
        burnTxHash: z
          .string()
          .optional()
          .describe('Optional source-chain burn tx hash, once known'),
      },
    },
    async ({ trackingId, source, destination, burnTxHash }) => {
      const issuedAtHex = trackingId.startsWith('fmb_') ? trackingId.slice(4, 8) : '0000';
      const issuedAtSeed = parseInt(issuedAtHex || '0', 16);
      const ageSeconds = (Date.now() / 1000 + issuedAtSeed) % 120;
      const stage = stageFromAge(ageSeconds);

      const status: TransferStatus = {
        trackingId,
        stage,
        source,
        destination,
        burnTxHash: burnTxHash as TransferStatus['burnTxHash'],
        attestation: stage === 'pending' ? undefined : '0x' + '0'.repeat(128) as TransferStatus['attestation'],
        mintTxHash: stage === 'completed' ? '0x' + '0'.repeat(64) as TransferStatus['mintTxHash'] : undefined,
        updatedAt: new Date().toISOString(),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
      };
    },
  );
}
