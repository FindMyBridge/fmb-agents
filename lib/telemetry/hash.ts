import { createHash } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256Truncated(input: string, length = 16): string {
  return sha256Hex(input).slice(0, length);
}

/**
 * Day bucket as `YYYY-MM-DD` in UTC. Used as a daily rotating salt in the
 * session_id derivation so two calls from the same client on different days
 * cannot be linked.
 */
export function dayBucketUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
