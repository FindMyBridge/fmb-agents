/**
 * Telemetry types. See spec §4 and docs/telemetry.md for the data model.
 */

export type ClientClass =
  | 'claude_desktop'
  | 'claude_code'
  | 'cursor'
  | 'chatgpt'
  | 'agentcore'
  | 'n8n'
  | 'make'
  | 'curl_or_dev_tool'
  | 'browser'
  | 'unknown';

export type AmountBucket =
  | '<1'
  | '1-10'
  | '10-100'
  | '100-1k'
  | '1k-10k'
  | '10k-100k'
  | '>100k';

export type Status = 'ok' | 'client_error' | 'server_error';

export type ToolName =
  | 'get_supported_routes'
  | 'quote_transfer'
  | 'prepare_transfer'
  | 'prepare_mint'
  | 'track_transfer';

/**
 * Pre-hashed request identity that travels with the AsyncLocalStorage store.
 * `ipHash` and `uaHash` are computed in the route handler before storage
 * runs — the raw IP/UA never enter AsyncLocalStorage and never reach the
 * middleware or the serialized event.
 */
export interface RequestContext {
  userAgent: string | null;
  mcpClientName: string | null;
  mcpClientVersion: string | null;
  ipHash: string;
  uaHash: string;
  requestId: string;
}

export interface ToolCallInput {
  source?: unknown;
  destination?: unknown;
  amount?: unknown;
  burnTxHash?: unknown;
  [k: string]: unknown;
}

export interface McpEventRow {
  ts: string;
  tool: ToolName;
  session_id: string;
  client_class: ClientClass;
  client_raw_ua_hash: string;
  source_chain_id: number | null;
  dest_chain_id: number | null;
  asset_symbol: string | null;
  amount_bucket: AmountBucket | null;
  status: Status;
  error_code: string | null;
  latency_ms: number;
  external_latency_ms: number | null;
  burn_tx_hash_present: boolean | null;
  request_id: string;
}
