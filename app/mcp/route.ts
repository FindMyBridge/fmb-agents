import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { currentNetwork } from '@/lib/chains';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(): Promise<Response> {
  return Response.json({
    name: 'fmb-agents',
    version: '0.1.0',
    network: currentNetwork(),
    transport: 'streamable-http',
    tools: ['get_supported_routes', 'quote_transfer', 'prepare_transfer', 'track_transfer'],
    docs: 'https://findmybridge.com',
    note: 'POST JSON-RPC 2.0 messages to this endpoint per the MCP spec.',
  });
}
