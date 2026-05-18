import { currentNetwork, getChains } from '@/lib/chains';
import { classifyClient } from './client-class';
import { classifyError } from './error-codes';
import { dayBucketUtc, sha256Hex, sha256Truncated } from './hash';
import type {
  AmountBucket,
  ClientClass,
  McpEventRow,
  RequestContext,
  Status,
  ToolCallInput,
  ToolName,
} from './types';

const SUPPORTED_ASSETS = new Set(['USDC']);

export function bucketAmount(amount: unknown): AmountBucket | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = typeof amount === 'string' ? Number(amount) : typeof amount === 'number' ? amount : Number(String(amount));
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1) return '<1';
  if (n < 10) return '1-10';
  if (n < 100) return '10-100';
  if (n < 1_000) return '100-1k';
  if (n < 10_000) return '1k-10k';
  if (n < 100_000) return '10k-100k';
  return '>100k';
}

function resolveChainId(key: unknown): number | null {
  if (key === undefined || key === null) return null;
  if (typeof key !== 'string' || key.length === 0) return 0;
  const chain = getChains(currentNetwork()).find((c) => c.key === key);
  return chain ? chain.chainId : 0;
}

function normalizeAsset(input: ToolCallInput): string | null {
  const a = typeof input.asset === 'string' ? input.asset : null;
  if (a === null) return input.source !== undefined || input.destination !== undefined ? 'USDC' : null;
  return SUPPORTED_ASSETS.has(a) ? a : 'other';
}

function burnTxHashPresent(input: ToolCallInput, tool: ToolName): boolean | null {
  if (tool !== 'track_transfer' && tool !== 'prepare_mint') return null;
  return typeof input.burnTxHash === 'string' && input.burnTxHash.length > 0;
}

export function buildClientRawUaHash(ctx: RequestContext): string {
  const material = [
    ctx.userAgent ?? '',
    ctx.mcpClientName ?? '',
    ctx.mcpClientVersion ?? '',
  ].join('|');
  return sha256Truncated(material, 16);
}

/**
 * session_id = sha256(ip_hash || ua_hash || day_bucket). The day_bucket makes
 * the id rotate at UTC midnight: the same caller looks identical within a day
 * but unlinkable across days. The raw IP is hashed before it enters this
 * function and is never persisted (see middleware).
 */
export function buildSessionId(ipHash: string, uaHash: string, now: Date = new Date()): string {
  return sha256Hex([ipHash, uaHash, dayBucketUtc(now)].join('|'));
}

export interface SerializeEventArgs {
  tool: ToolName;
  input: ToolCallInput;
  ctx: RequestContext;
  startedAt: Date;
  latencyMs: number;
  externalLatencyMs: number | null;
  status: Status;
  err: unknown | null;
}

/**
 * The ONLY place an `McpEventRow` is constructed. Every test of no-leak
 * goes through this function with adversarial inputs and asserts that
 * `JSON.stringify(row)` does not contain any sensitive substring.
 */
export function serializeEvent(args: SerializeEventArgs): McpEventRow {
  const client_class: ClientClass = classifyClient(args.ctx.userAgent, args.ctx.mcpClientName);
  const errorClassified = args.err === null ? null : classifyError(args.err);
  const status: Status = errorClassified?.status ?? args.status;

  return {
    ts: args.startedAt.toISOString(),
    tool: args.tool,
    session_id: buildSessionId(args.ctx.ipHash, args.ctx.uaHash, args.startedAt),
    client_class,
    client_raw_ua_hash: buildClientRawUaHash(args.ctx),
    source_chain_id: resolveChainId(args.input.source),
    dest_chain_id: resolveChainId(args.input.destination),
    asset_symbol: normalizeAsset(args.input),
    amount_bucket: bucketAmount(args.input.amount),
    status,
    error_code: errorClassified?.code ?? null,
    latency_ms: Math.max(0, Math.round(args.latencyMs)),
    external_latency_ms: args.externalLatencyMs,
    burn_tx_hash_present: burnTxHashPresent(args.input, args.tool),
    request_id: args.ctx.requestId,
  };
}
