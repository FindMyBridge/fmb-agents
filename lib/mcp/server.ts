import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetSupportedRoutes } from './tools/get-supported-routes';
import { registerQuoteTransfer } from './tools/quote-transfer';
import { registerPrepareTransfer } from './tools/prepare-transfer';
import { registerPrepareMint } from './tools/prepare-mint';
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
        'FMB Agents — stablecoin cross-chain MCP from Find My Bridge. Supports USDC over CCTP V2 between Ethereum, Arbitrum, Base, Optimism, Polygon, and Avalanche. The 5 tools cover the full burn → attestation → mint cycle: prepare_transfer (burn), prepare_mint (mint), plus get_supported_routes, quote_transfer, and track_transfer.',
    },
  );

  registerGetSupportedRoutes(server);
  registerQuoteTransfer(server);
  registerPrepareTransfer(server);
  registerPrepareMint(server);
  registerTrackTransfer(server);

  return server;
}
