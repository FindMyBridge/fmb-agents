import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { currentNetwork, getChains } from '@/lib/chains';
import { withTelemetry } from '@/lib/telemetry/middleware';
import type { Route } from '@/lib/types';

const chainKeyEnum = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'optimism',
  'polygon',
  'avalanche',
]);

export function registerGetSupportedRoutes(server: McpServer): void {
  server.registerTool(
    'get_supported_routes',
    {
      title: 'List supported stablecoin routes',
      description:
        'Returns every supported source → destination chain pair for USDC, with the available cross-chain rails for each. Phase 1: CCTP V2 only, EVM ↔ EVM.',
      inputSchema: {
        source: chainKeyEnum.optional().describe('Optional filter: only return routes departing this chain'),
        destination: chainKeyEnum.optional().describe('Optional filter: only return routes arriving on this chain'),
      },
    },
    withTelemetry('get_supported_routes', async ({ source, destination }) => {
      const chains = getChains(currentNetwork());
      const routes: Route[] = [];
      for (const src of chains) {
        if (source && src.key !== source) continue;
        for (const dst of chains) {
          if (dst.key === src.key) continue;
          if (destination && dst.key !== destination) continue;
          routes.push({
            source: src.key,
            destination: dst.key,
            asset: 'USDC',
            rails: ['cctp-v2'],
          });
        }
      }
      const payload = {
        network: currentNetwork(),
        count: routes.length,
        routes,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    }),
  );
}
