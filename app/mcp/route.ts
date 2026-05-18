import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { currentNetwork } from '@/lib/chains';
import { runWithTelemetryContext } from '@/lib/telemetry/context';
import { sha256Truncated } from '@/lib/telemetry/hash';
import { isTelemetryEnabled } from '@/lib/telemetry/supabase';

export const runtime = 'nodejs';

function firstForwardedIp(forwardedFor: string | null): string {
  // X-Forwarded-For is a comma-separated chain; the leftmost entry is the
  // original client per RFC 7239. Hashed immediately — raw never persisted.
  if (!forwardedFor) return '';
  return forwardedFor.split(',')[0]?.trim() ?? '';
}

async function handle(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!isTelemetryEnabled()) return handle(request);

  const userAgent = request.headers.get('user-agent');
  const mcpClientName = request.headers.get('mcp-client-name');
  const mcpClientVersion = request.headers.get('mcp-client-version');
  const rawIp = firstForwardedIp(request.headers.get('x-forwarded-for'));

  const ipHash = rawIp ? sha256Truncated(rawIp, 32) : 'no-ip';
  const uaHash = sha256Truncated(`${userAgent ?? ''}|${mcpClientName ?? ''}|${mcpClientVersion ?? ''}`, 32);

  return runWithTelemetryContext(
    {
      userAgent,
      mcpClientName,
      mcpClientVersion,
      ipHash,
      uaHash,
      requestId: randomUUID(),
    },
    () => handle(request),
  );
}

export async function GET(): Promise<Response> {
  return Response.json({
    name: 'fmb-agents',
    version: '0.1.0',
    network: currentNetwork(),
    transport: 'streamable-http',
    tools: [
      'get_supported_routes',
      'quote_transfer',
      'prepare_transfer',
      'prepare_mint',
      'track_transfer',
    ],
    docs: 'https://findmybridge.com',
    note: 'POST JSON-RPC 2.0 messages to this endpoint per the MCP spec.',
  });
}
