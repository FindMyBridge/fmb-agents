/**
 * Extracts `params.clientInfo.name` from a parsed JSON-RPC body if — and only
 * if — it is an `initialize` message. The MCP spec allows a single message or
 * a JSON-RPC batch (array); we scan both. Returns null for anything that is
 * not an initialize carrying a string name.
 *
 * The body is parsed by the caller (route handler) from a non-consuming peek
 * of the request; this function is pure and never touches the network.
 */
export function extractClientInfoName(body: unknown): string | null {
  const messages = Array.isArray(body) ? body : [body];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const m = msg as { method?: unknown; params?: unknown };
    if (m.method !== 'initialize') continue;
    const params = m.params;
    if (!params || typeof params !== 'object') continue;
    const clientInfo = (params as { clientInfo?: unknown }).clientInfo;
    if (!clientInfo || typeof clientInfo !== 'object') continue;
    const name = (clientInfo as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return null;
}
