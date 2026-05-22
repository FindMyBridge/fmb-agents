import { describe, it, expect } from 'vitest';
import { extractClientInfoName } from '@/lib/telemetry/initialize';
import { mapClientInfoName, resolveClientClass } from '@/lib/telemetry/session-store';

describe('mapClientInfoName', () => {
  it('maps Claude Desktop', () => {
    expect(mapClientInfoName('claude-ai')).toBe('claude_desktop');
    expect(mapClientInfoName('Claude Desktop')).toBe('claude_desktop');
    expect(mapClientInfoName('claude')).toBe('claude_desktop');
  });

  it('maps Claude Code and does NOT misfile it as Claude Desktop', () => {
    // The whole "claude (without code) → claude_desktop" rule hinges on the
    // order of the checks. This is the safety net for that ordering.
    expect(mapClientInfoName('claude-code')).toBe('claude_code');
    expect(mapClientInfoName('Claude Code')).toBe('claude_code');
    expect(mapClientInfoName('claude-code')).not.toBe('claude_desktop');
  });

  it('maps cursor / chatgpt / agentcore / n8n / make', () => {
    expect(mapClientInfoName('cursor-vscode')).toBe('cursor');
    expect(mapClientInfoName('Cursor')).toBe('cursor');
    expect(mapClientInfoName('chatgpt')).toBe('chatgpt');
    expect(mapClientInfoName('OpenAI-MCP')).toBe('chatgpt');
    expect(mapClientInfoName('Bedrock AgentCore')).toBe('agentcore');
    expect(mapClientInfoName('n8n')).toBe('n8n');
    expect(mapClientInfoName('make.com')).toBe('make');
    expect(mapClientInfoName('integromat')).toBe('make');
  });

  it('maps dev/inspector tools', () => {
    expect(mapClientInfoName('mcp-inspector')).toBe('curl_or_dev_tool');
    expect(mapClientInfoName('Postman')).toBe('curl_or_dev_tool');
  });

  it('normalizes case and whitespace', () => {
    expect(mapClientInfoName('  CLAUDE-AI  ')).toBe('claude_desktop');
    expect(mapClientInfoName('  Claude-Code ')).toBe('claude_code');
  });

  it('falls back to unknown', () => {
    expect(mapClientInfoName('SomeRandomClient')).toBe('unknown');
    expect(mapClientInfoName('')).toBe('unknown');
    expect(mapClientInfoName(null)).toBe('unknown');
    expect(mapClientInfoName(undefined)).toBe('unknown');
  });
});

describe('resolveClientClass precedence', () => {
  it('persisted (≠ unknown) wins over the User-Agent fallback', () => {
    expect(resolveClientClass('claude_desktop', 'unknown')).toBe('claude_desktop');
    expect(resolveClientClass('claude_code', 'browser')).toBe('claude_code');
  });

  it('keeps the fallback when nothing is persisted', () => {
    expect(resolveClientClass(null, 'browser')).toBe('browser');
    expect(resolveClientClass(null, 'unknown')).toBe('unknown');
  });

  it('a persisted unknown does NOT clobber a positive User-Agent match', () => {
    expect(resolveClientClass('unknown', 'cursor')).toBe('cursor');
    expect(resolveClientClass('unknown', 'unknown')).toBe('unknown');
  });
});

describe('extractClientInfoName', () => {
  const initMsg = (name: unknown) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      clientInfo: { name, version: '0.1.0' },
    },
  });

  it('extracts name from an initialize message', () => {
    expect(extractClientInfoName(initMsg('claude-ai'))).toBe('claude-ai');
  });

  it('returns null for non-initialize messages', () => {
    expect(
      extractClientInfoName({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: {} }),
    ).toBeNull();
  });

  it('finds the initialize message inside a JSON-RPC batch', () => {
    expect(extractClientInfoName([{ method: 'tools/list' }, initMsg('cursor')])).toBe('cursor');
  });

  it('returns null for garbage, missing clientInfo, or non-string name', () => {
    expect(extractClientInfoName('not an object')).toBeNull();
    expect(extractClientInfoName(null)).toBeNull();
    expect(extractClientInfoName({ method: 'initialize', params: {} })).toBeNull();
    expect(extractClientInfoName(initMsg(42))).toBeNull();
    expect(extractClientInfoName(initMsg(''))).toBeNull();
  });
});
