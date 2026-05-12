import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetSupportedRoutes } from './tools/get-supported-routes';
import { registerQuoteTransfer } from './tools/quote-transfer';
import { registerPrepareTransfer } from './tools/prepare-transfer';
import { registerTrackTransfer } from './tools/track-transfer';

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'fmb-agents',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        'FMB Agents — stablecoin cross-chain MCP from Find My Bridge. Phase 1 supports USDC over CCTP V2 between Ethereum, Arbitrum, Base, Optimism, Polygon, and Avalanche.',
    },
  );

  registerGetSupportedRoutes(server);
  registerQuoteTransfer(server);
  registerPrepareTransfer(server);
  registerTrackTransfer(server);

  return server;
}
