import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { currentNetwork, getChain } from '@/lib/chains';
import { encodeApprove, encodeDepositForBurn } from '@/lib/rails/cctp/deposit-for-burn';
import { withTelemetry } from '@/lib/telemetry/middleware';
import type { PreparedTransfer } from '@/lib/types';

const chainKeyEnum = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'optimism',
  'polygon',
  'avalanche',
]);

const USDC_DECIMALS = 6;

function toUsdcUnits(amount: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw new Error(`Invalid USDC amount "${amount}".`);
  }
  const [whole, frac = ''] = amount.split('.');
  const padded = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || '0');
}

function randomTrackingId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'fmb_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function registerPrepareTransfer(server: McpServer): void {
  server.registerTool(
    'prepare_transfer',
    {
      title: 'Prepare an unsigned cross-chain transfer (burn step)',
      description:
        'Builds the unsigned source-chain transactions for a CCTP V2 transfer: (1) ERC-20 approve on the USDC token contract, (2) depositForBurn on the TokenMessengerV2. Non-custodial — the server never holds keys. The caller signs both transactions on the source chain. This is only the burn step; after the burn confirms, call `prepare_mint` with the burn tx hash to build the unsigned `receiveMessage` transaction for the destination chain. The output\'s `nextStep` field carries the structured handoff.',
      inputSchema: {
        source: chainKeyEnum.describe('Source chain key'),
        destination: chainKeyEnum.describe('Destination chain key'),
        amount: z.string().describe('Amount of USDC to send as a decimal string'),
        recipient: z.string().describe('Recipient address on the destination chain (0x...)'),
        sender: z.string().describe('Sender address on the source chain (0x...)'),
        maxFee: z
          .string()
          .describe('Max fee allowed in USDC decimal string (from quote_transfer.maxFee)'),
        minFinalityThreshold: z
          .number()
          .int()
          .describe('Finality threshold from the quote (e.g. 1000 for fast, 2000 for standard)'),
      },
    },
    withTelemetry('prepare_transfer', async ({ source, destination, amount, recipient, sender, maxFee, minFinalityThreshold }) => {
      if (source === destination) {
        throw new Error('source and destination must differ');
      }
      if (!isAddress(recipient)) throw new Error(`Invalid recipient address: ${recipient}`);
      if (!isAddress(sender)) throw new Error(`Invalid sender address: ${sender}`);

      const network = currentNetwork();
      const src = getChain(source, network);
      const dst = getChain(destination, network);

      const amountUnits = toUsdcUnits(amount);
      const maxFeeUnits = toUsdcUnits(maxFee);

      const approvalData = encodeApprove(src.tokenMessengerV2 as Address, amountUnits);
      const burnData = encodeDepositForBurn({
        amount: amountUnits,
        destinationDomain: dst.cctpDomain,
        mintRecipient: recipient as Address,
        burnToken: src.usdc as Address,
        maxFee: maxFeeUnits,
        minFinalityThreshold,
      });

      const prepared: PreparedTransfer = {
        rail: 'cctp-v2',
        source,
        destination,
        to: src.tokenMessengerV2 as Address,
        data: burnData,
        value: '0',
        chainId: src.chainId,
        approval: {
          to: src.usdc as Address,
          data: approvalData,
          value: '0',
        },
        expectedBurnTxHashFormat:
          '0x[64 hex chars] — submit approve, wait for confirmation, then submit depositForBurn. After the burn confirms, pass its tx hash to `prepare_mint` to build the unsigned receiveMessage tx for the destination chain.',
        trackingId: randomTrackingId(),
        nextStep: {
          tool: 'prepare_mint',
          description:
            'After the burn confirms on the source chain, call prepare_mint with the burn tx hash to build the unsigned receiveMessage transaction for the destination chain.',
          requires: {
            burnTxHash: 'The source-chain tx hash of the confirmed depositForBurn',
          },
        },
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(prepared, null, 2) }],
      };
    }),
  );
}
