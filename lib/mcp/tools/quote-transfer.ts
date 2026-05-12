import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { currentNetwork, getChain } from '@/lib/chains';
import { getFees } from '@/lib/rails/cctp/iris-client';
import type { Quote } from '@/lib/types';

const chainKeyEnum = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'optimism',
  'polygon',
  'avalanche',
]);

const USDC_DECIMALS = 6;
const BPS_DENOMINATOR = 10_000n;
const FEE_PRECISION = 1_000_000n;

function toUsdcUnits(amount: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw new Error(`Invalid USDC amount "${amount}". Use a decimal string with up to 6 decimals.`);
  }
  const [whole, frac = ''] = amount.split('.');
  const padded = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || '0');
}

function fromUsdcUnits(units: bigint): string {
  const whole = units / 10n ** BigInt(USDC_DECIMALS);
  const frac = (units % 10n ** BigInt(USDC_DECIMALS)).toString().padStart(USDC_DECIMALS, '0');
  return `${whole}.${frac}`.replace(/\.?0+$/, '') || '0';
}

export function registerQuoteTransfer(server: McpServer): void {
  server.registerTool(
    'quote_transfer',
    {
      title: 'Quote a stablecoin transfer',
      description:
        'Returns a live fee quote for moving USDC from source to destination via CCTP V2. Hits Circle Iris in real time. Speed "fast" uses the lower finality threshold (pre-finality, with fee). Speed "standard" uses the higher threshold (slower, lower or zero fee).',
      inputSchema: {
        source: chainKeyEnum.describe('Source chain key'),
        destination: chainKeyEnum.describe('Destination chain key'),
        amount: z
          .string()
          .describe('Amount of USDC to send as a decimal string (e.g. "100.50"). Up to 6 decimals.'),
        speed: z.enum(['fast', 'standard']).default('fast').describe('Transfer speed'),
      },
    },
    async ({ source, destination, amount, speed }) => {
      if (source === destination) {
        throw new Error('source and destination must differ');
      }
      const network = currentNetwork();
      const src = getChain(source, network);
      const dst = getChain(destination, network);

      const fees = await getFees(src.cctpDomain, dst.cctpDomain, network);
      if (!fees.length) {
        throw new Error(`No fee tiers available for ${source} → ${destination} on ${network}`);
      }

      const sorted = [...fees].sort((a, b) => a.finalityThreshold - b.finalityThreshold);
      const chosen = speed === 'fast' ? sorted[0] : sorted[sorted.length - 1];

      const amountIn = toUsdcUnits(amount);
      const feeScaled = BigInt(Math.ceil(chosen.minimumFee * Number(FEE_PRECISION)));
      const maxFee = (amountIn * feeScaled) / (BPS_DENOMINATOR * FEE_PRECISION);
      const amountOut = amountIn - maxFee;

      const estimatedSeconds = speed === 'fast' ? 20 : 900;
      const expiresAt = new Date(Date.now() + 10_000).toISOString();

      const quote: Quote = {
        rail: 'cctp-v2',
        source,
        destination,
        asset: 'USDC',
        amountIn: fromUsdcUnits(amountIn),
        amountOut: fromUsdcUnits(amountOut),
        maxFee: fromUsdcUnits(maxFee),
        estimatedSeconds,
        minFinalityThreshold: chosen.finalityThreshold,
        expiresAt,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(quote, null, 2) }],
      };
    },
  );
}
