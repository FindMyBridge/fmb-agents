import type { Status } from './types';

/**
 * Closed error taxonomy (spec §6). NEVER persist raw error messages — they can
 * leak Iris URLs, RPC endpoints, wallet addresses, or tx hashes. Map to one of
 * these codes or fall back to `internal_error`.
 */
export const ERROR_CODES = [
  'invalid_chain',
  'unsupported_route',
  'invalid_amount',
  'invalid_address',
  'invalid_input',
  'iris_unavailable',
  'iris_timeout',
  'external_api_error',
  'attestation_unavailable',
  'rpc_error',
  'rate_limited',
  'internal_error',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

interface Match {
  code: ErrorCode;
  status: Status;
  test: (msg: string, name: string) => boolean;
}

const ci = (msg: string, needle: string): boolean => msg.toLowerCase().includes(needle.toLowerCase());

// Order matters — first match wins. Specific → generic.
const MATCHERS: Match[] = [
  { code: 'invalid_address', status: 'client_error', test: (m) => ci(m, 'invalid recipient address') || ci(m, 'invalid sender address') },
  { code: 'invalid_amount', status: 'client_error', test: (m) => ci(m, 'invalid usdc amount') || ci(m, 'invalid amount') },
  { code: 'unsupported_route', status: 'client_error', test: (m) => ci(m, 'source and destination must differ') || ci(m, 'no fee tiers available') },
  { code: 'invalid_chain', status: 'client_error', test: (m) => ci(m, 'unknown chain') || ci(m, 'no chain with chainid') || ci(m, 'no chain with cctp domain') },
  { code: 'iris_timeout', status: 'server_error', test: (m, n) => (n === 'AbortError' && ci(m, 'iris')) || (ci(m, 'iris') && ci(m, 'timeout')) },
  { code: 'iris_unavailable', status: 'server_error', test: (m) => ci(m, 'iris 5') || ci(m, 'iris 502') || ci(m, 'iris 503') || ci(m, 'iris 504') },
  { code: 'external_api_error', status: 'server_error', test: (m) => ci(m, 'iris ') || ci(m, 'iris_api') || ci(m, 'iris-api') },
  { code: 'attestation_unavailable', status: 'server_error', test: (m) => ci(m, 'no cctp message found') || ci(m, 'attestation not ready') },
  { code: 'rate_limited', status: 'server_error', test: (m) => ci(m, 'rate limit') || ci(m, 'too many requests') || ci(m, '429') },
  { code: 'rpc_error', status: 'server_error', test: (m, n) => n === 'HttpRequestError' || ci(m, 'rpc') || ci(m, 'execution reverted') || ci(m, 'contractfunctionexecutionerror') },
  { code: 'invalid_input', status: 'client_error', test: (m, n) => n === 'ZodError' || ci(m, 'validation') },
];

export function classifyError(err: unknown): { code: ErrorCode; status: Status } {
  const e = err instanceof Error ? err : new Error(String(err));
  const msg = e.message ?? '';
  const name = e.name ?? '';
  for (const m of MATCHERS) {
    if (m.test(msg, name)) return { code: m.code, status: m.status };
  }
  return { code: 'internal_error', status: 'server_error' };
}
