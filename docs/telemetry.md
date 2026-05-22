# Telemetry

Privacy-first instrumentation of `agents.findmybridge.com/mcp`. One event per
tool call. The full design lives in the Notion spec "FMB Agents — Telemetry
Spec v1"; this document is the operational reference.

## What gets recorded

Per tool call (see [lib/telemetry/types.ts](../lib/telemetry/types.ts)):

- `tool` — one of the 5 MCP tools.
- `client_class` — resolved with precedence: the `clientInfo.name` captured in
  the `initialize` handshake and persisted in `mcp_sessions`
  ([lib/telemetry/session-store.ts](../lib/telemetry/session-store.ts)) wins;
  otherwise the User-Agent classifier
  ([lib/telemetry/client-class.ts](../lib/telemetry/client-class.ts)); otherwise
  `unknown`. Real MCP clients send no recognizable UA, so `clientInfo` is the
  reliable source — see "Client classification" below.
- `client_raw_ua_hash` — sha256 of UA + MCP headers, truncated to 16 chars.
  Lets us see a client pattern repeat without storing the UA.
- `session_id` — sha256(`ip_hash` || `ua_hash` || `day_bucket_utc`).
  Rotates daily so callers cannot be linked across days.
- `source_chain_id`, `dest_chain_id` — resolved chain IDs, or `0` for
  unsupported chain keys (preserves "someone tried Solana" signal without
  storing the raw input).
- `amount_bucket` — logarithmic bucket of the input amount.
- `status` — `ok` / `client_error` / `server_error`.
- `error_code` — one of the closed taxonomy in
  [lib/telemetry/error-codes.ts](../lib/telemetry/error-codes.ts). Never the
  raw error message.
- `latency_ms` — wall time around the handler.
- `external_latency_ms` — sum of round-trip time to Iris + destination RPC
  reads. `NULL` when the tool makes no external calls. Lets us answer "is
  Iris the bottleneck?" without a second instrumentation pass.
- `burn_tx_hash_present` — boolean for `track_transfer` / `prepare_mint`.
  Never the hash itself.
- `request_id` — UUID, for correlating with Vercel Function logs.

## What does NOT get recorded

- Wallet addresses (sender, recipient, signer).
- Exact amounts.
- Tx hashes (the boolean tells us a hash was passed; the value never lands).
- Raw IPs (the leftmost `X-Forwarded-For` entry is hashed into `ip_hash`
  inside the route handler and discarded immediately).
- Raw User-Agent or any other request header content.
- Raw error messages.

`test/telemetry-no-leak.test.ts` enforces this with adversarial inputs.

## Why `after()` and not `setImmediate`

We schedule the Supabase insert with `after()` from `next/server`, not
`setImmediate`.

- Vercel Fluid Compute can freeze or recycle a function instance after the
  response is sent. `setImmediate` microtasks queued on a soon-to-be-evicted
  instance can be silently dropped.
- `after()` is backed by Vercel's `waitUntil`, which extends the serverless
  invocation lifetime until the queued promises settle. The client-perceived
  response latency is identical (the response is already sent), but delivery
  is guaranteed.
- Pre-launch every event is a high-value signal of real adoption — not steady-
  state noise. We accept the small platform-managed cost of `waitUntil` over
  silently losing first-mover events. If post-launch volume makes
  `waitUntil` cost-relevant, this trade-off is worth reopening.

If the Supabase insert itself fails inside the `after()` callback, the error
is logged to stderr (captured by Vercel) and dropped. No retries on the hot
path. See [lib/telemetry/middleware.ts](../lib/telemetry/middleware.ts).

## Env vars (production)

Set these in the Vercel dashboard → Settings → Environment Variables →
Production. They are **never** committed to the repo.

- `SUPABASE_URL` — project URL of `fmb-agents-telemetry`.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key (bypasses RLS; backend-only).
- `TELEMETRY_ENABLED=true` — feature flag. When unset or anything other than
  the literal string `"true"`, the middleware is a true no-op (no wrapper,
  no Supabase client, no network calls).
- `SAMPLE_RATE` (optional, default `1.0`) — fraction of events to persist.
  Applied at the `scheduleInsert` step in
  [lib/telemetry/middleware.ts](../lib/telemetry/middleware.ts), after the
  latency measurement has been taken — so sampling never skews the timing
  numbers it would have reported.
- `CRON_SECRET` — random string. Vercel Cron sends it as
  `Authorization: Bearer ${CRON_SECRET}` on every invocation of
  `/api/cron/telemetry-rollup`.

The MCP runs unchanged when telemetry is off; this is a hard guarantee covered
by `test/telemetry-middleware.test.ts`.

## Dashboard

Supabase Reports → "FMB Agents — MCP telemetry" in the
[`fmb-agents-telemetry`](https://supabase.com/dashboard/project/qlqypxkkgrylwhoevpgf)
project. Each of the 10 queries from
[telemetry-queries.sql](./telemetry-queries.sql) is pinned as a block.

To access: Supabase login → project `fmb-agents-telemetry` → Reports
sidebar → "FMB Agents — MCP telemetry".

The raw SQL is the source of truth — the Report is a visualization on top.
Anything the Report can't answer, the SQL editor can.

## Tables

- `mcp_events` — one row per tool call. Raw events. Retention 90 days
  (purge cron is a planned follow-up; today we just keep everything).
- `mcp_events_daily` — daily rollup keyed by `(day, tool, client_class)`.
  Computed by `/api/cron/telemetry-rollup` at 02:00 UTC via the Postgres
  function `rollup_mcp_events(target_day DATE)`. Idempotent.
- `mcp_sessions` — map `session_id → client_class`, written once per session
  on the `initialize` handshake (see "Client classification"). Read on each
  tool call to resolve `client_class`. PK lookup; no PII.

Schema lives in the migration history of the Supabase project. The
`mcp_sessions` DDL:

```sql
CREATE TABLE IF NOT EXISTS public.mcp_sessions (
  session_id       TEXT PRIMARY KEY,
  client_class     TEXT NOT NULL,
  client_info_name TEXT,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mcp_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated blocked; service-role bypasses RLS.
```

## Client classification

The reliable signal for which client is calling is `clientInfo.name`, sent in
the JSON-RPC `initialize` message — not in any header. But `initialize` and the
later `tools/call` events are separate HTTP requests, so we bridge them via
`session_id`:

- `session_id = sha256(ip_hash || ua_hash || day_bucket_utc)` is derived from
  HTTP headers the client sends identically on every request, so `initialize`
  and its tool calls compute the same id.
- On `initialize` ([app/mcp/route.ts](../app/mcp/route.ts)) we peek the body
  (via `request.clone()`, leaving the original for the transport), map
  `clientInfo.name → client_class`, and `after()`-persist the row to
  `mcp_sessions`. Fire-and-forget; never blocks the handshake.
- On each tool call, the telemetry middleware resolves `client_class` from
  `mcp_sessions` by `session_id`, falling back to the User-Agent classifier and
  then `unknown`.

The raw `client_info_name` is stored to discover client names that aren't yet
mapped; extend the map in
[lib/telemetry/session-store.ts](../lib/telemetry/session-store.ts).

## RLS

RLS is enabled with no policies on both tables. The service-role key bypasses
RLS — the backend writes freely. The anon/authenticated roles are blocked
entirely, which is what we want since no client ever talks to Supabase
directly.

## Cron

Vercel Cron at `0 2 * * *` (02:00 UTC = 04:00 Madrid in summer) hits
`/api/cron/telemetry-rollup` with `Authorization: Bearer ${CRON_SECRET}` and
runs the previous-day rollup. Configuration in
[../vercel.json](../vercel.json).
