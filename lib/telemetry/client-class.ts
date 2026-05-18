import type { ClientClass } from './types';

interface Pattern {
  cls: ClientClass;
  test: (ua: string, mcpClientName: string | null) => boolean;
}

const includesCI = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.toLowerCase());

const PATTERNS: Pattern[] = [
  // Claude Desktop self-identifies via the MCP client-name handshake.
  { cls: 'claude_desktop', test: (ua, mcp) => mcp === 'claude-ai' || includesCI(ua, 'Claude/Desktop') },
  // Claude Code CLI / Anthropic SDK.
  { cls: 'claude_code', test: (ua, mcp) => mcp === 'claude-code' || includesCI(ua, 'Claude-Code') },
  // Cursor IDE.
  { cls: 'cursor', test: (ua) => includesCI(ua, 'Cursor/') },
  // OpenAI / ChatGPT MCP clients — pattern still firming up; conservative match.
  { cls: 'chatgpt', test: (ua, mcp) => includesCI(ua, 'OpenAI') || mcp === 'chatgpt' },
  // AWS Bedrock AgentCore.
  { cls: 'agentcore', test: (ua) => includesCI(ua, 'AgentCore') || includesCI(ua, 'Bedrock') },
  // Automation builders.
  { cls: 'n8n', test: (ua) => includesCI(ua, 'n8n') },
  { cls: 'make', test: (ua) => includesCI(ua, 'Make/') || includesCI(ua, 'integromat') },
  // Dev / curl-style tools — useful to separate exploratory probes from real agents.
  {
    cls: 'curl_or_dev_tool',
    test: (ua) =>
      includesCI(ua, 'curl/') ||
      includesCI(ua, 'HTTPie') ||
      includesCI(ua, 'Postman') ||
      includesCI(ua, 'Insomnia') ||
      includesCI(ua, 'node-fetch') ||
      includesCI(ua, 'axios'),
  },
  // Real browser — almost certainly a human poking around, not an agent.
  {
    cls: 'browser',
    test: (ua) =>
      (includesCI(ua, 'Mozilla/') || includesCI(ua, 'AppleWebKit/')) &&
      !includesCI(ua, 'Claude') &&
      !includesCI(ua, 'Cursor'),
  },
];

export function classifyClient(
  userAgent: string | null | undefined,
  mcpClientName: string | null | undefined,
): ClientClass {
  const ua = (userAgent ?? '').trim();
  const mcp = (mcpClientName ?? '').trim() || null;
  for (const p of PATTERNS) {
    if (p.test(ua, mcp)) return p.cls;
  }
  return 'unknown';
}
