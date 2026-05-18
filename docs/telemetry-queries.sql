-- FMB Agents — MCP telemetry queries (spec §8).
-- Paste into Supabase SQL editor (project: fmb-agents-telemetry).
-- Pinned 1:1 in the Supabase Report "FMB Agents — MCP telemetry".

-- 1. Daily volume by tool, last 30 days.
SELECT
  date_trunc('day', ts)::DATE AS day,
  tool,
  COUNT(*) AS calls
FROM mcp_events
WHERE ts >= now() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, calls DESC;

-- 2. Distribution of client_class, last 7 days.
SELECT
  client_class,
  COUNT(*) AS calls,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM mcp_events
WHERE ts >= now() - INTERVAL '7 days'
GROUP BY client_class
ORDER BY calls DESC;

-- 3. Top 10 (source_chain_id, dest_chain_id) pairs, last 30 days.
SELECT
  source_chain_id,
  dest_chain_id,
  COUNT(*) AS calls
FROM mcp_events
WHERE ts >= now() - INTERVAL '30 days'
  AND source_chain_id IS NOT NULL
  AND dest_chain_id IS NOT NULL
GROUP BY 1, 2
ORDER BY calls DESC
LIMIT 10;

-- 4. Conversion rate quote_transfer → prepare_transfer per session.
-- A session "converts" if it called both tools within the same day.
WITH per_session AS (
  SELECT
    session_id,
    BOOL_OR(tool = 'quote_transfer')   AS quoted,
    BOOL_OR(tool = 'prepare_transfer') AS prepared
  FROM mcp_events
  WHERE ts >= now() - INTERVAL '30 days'
  GROUP BY session_id
)
SELECT
  COUNT(*) FILTER (WHERE quoted)               AS sessions_with_quote,
  COUNT(*) FILTER (WHERE quoted AND prepared)  AS sessions_with_prepare,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE quoted AND prepared)
    / NULLIF(COUNT(*) FILTER (WHERE quoted), 0),
    2
  ) AS conversion_pct
FROM per_session;

-- 5. Error rate per tool, last 7 days.
SELECT
  tool,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE status <> 'ok') AS errors,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status <> 'ok') / COUNT(*),
    2
  ) AS error_pct
FROM mcp_events
WHERE ts >= now() - INTERVAL '7 days'
GROUP BY tool
ORDER BY error_pct DESC;

-- 6. Top 10 error_codes, last 30 days.
SELECT
  error_code,
  COUNT(*) AS occurrences
FROM mcp_events
WHERE ts >= now() - INTERVAL '30 days'
  AND error_code IS NOT NULL
GROUP BY error_code
ORDER BY occurrences DESC
LIMIT 10;

-- 7. Unique sessions per day (proxy for DAU), last 30 days.
SELECT
  date_trunc('day', ts)::DATE AS day,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM mcp_events
WHERE ts >= now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 8. Amount bucket distribution in quote_transfer, last 30 days.
SELECT
  amount_bucket,
  COUNT(*) AS calls
FROM mcp_events
WHERE ts >= now() - INTERVAL '30 days'
  AND tool = 'quote_transfer'
  AND amount_bucket IS NOT NULL
GROUP BY amount_bucket
ORDER BY
  CASE amount_bucket
    WHEN '<1'       THEN 1
    WHEN '1-10'     THEN 2
    WHEN '10-100'   THEN 3
    WHEN '100-1k'   THEN 4
    WHEN '1k-10k'   THEN 5
    WHEN '10k-100k' THEN 6
    WHEN '>100k'    THEN 7
  END;

-- 9. Latency p50/p95/p99 per tool, last 7 days. Includes external latency
--    (Iris + RPC) when present so you can spot the bottleneck.
SELECT
  tool,
  COUNT(*) AS calls,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p99_ms,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY external_latency_ms)
    FILTER (WHERE external_latency_ms IS NOT NULL)::INTEGER AS p50_external_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY external_latency_ms)
    FILTER (WHERE external_latency_ms IS NOT NULL)::INTEGER AS p95_external_ms
FROM mcp_events
WHERE ts >= now() - INTERVAL '7 days'
GROUP BY tool
ORDER BY calls DESC;

-- 10. Clients with >5 calls in a single session (real use signal).
SELECT
  session_id,
  client_class,
  COUNT(*) AS calls,
  COUNT(DISTINCT tool) AS distinct_tools,
  MIN(ts) AS first_call,
  MAX(ts) AS last_call
FROM mcp_events
WHERE ts >= now() - INTERVAL '30 days'
GROUP BY session_id, client_class
HAVING COUNT(*) > 5
ORDER BY calls DESC
LIMIT 50;
