import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { currentNetwork } from '@/lib/chains';
import { runWithTelemetryContext } from '@/lib/telemetry/context';
import { sha256Truncated } from '@/lib/telemetry/hash';
import { extractClientInfoName } from '@/lib/telemetry/initialize';
import { buildSessionId } from '@/lib/telemetry/normalize';
import { recordSession } from '@/lib/telemetry/session-store';
import { isTelemetryEnabled } from '@/lib/telemetry/supabase';

export const runtime = 'nodejs';

function firstForwardedIp(forwardedFor: string | null): string {
  // X-Forwarded-For is a comma-separated chain; the leftmost entry is the
  // original client per RFC 7239. Hashed immediately — raw never persisted.
  if (!forwardedFor) return '';
  return forwardedFor.split(',')[0]?.trim() ?? '';
}

/**
 * Inspects the JSON-RPC body for an `initialize` message and, if present,
 * schedules a fire-and-forget persist of { session_id → client_class }. Reads
 * a clone so the original request body stays intact for the transport. Never
 * throws and never blocks the handshake: a bad body or sink failure is
 * swallowed, telemetry degrades, the request proceeds.
 */
async function captureInitialize(request: Request, ipHash: string, uaHash: string): Promise<void> {
  let clientInfoName: string | null = null;
  try {
    const peek = await request.clone().text();
    if (peek) clientInfoName = extractClientInfoName(JSON.parse(peek));
  } catch {
    // Non-JSON body, read error, or non-initialize message — nothing to do.
    return;
  }
  if (!clientInfoName) return;
  const sessionId = buildSessionId(ipHash, uaHash);
  after(() => recordSession(sessionId, clientInfoName));
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

  // Capture clientInfo from the `initialize` handshake. It arrives in the
  // JSON-RPC body — not the headers — and on a separate HTTP request from the
  // later tools/call events. We persist { session_id → client_class } so those
  // events can resolve it. session_id is derived from ipHash+uaHash (stable
  // across all requests of one client), so the same id links both sides.
  // Peek the body via clone() so the transport still reads the original.
  await captureInitialize(request, ipHash, uaHash);

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
