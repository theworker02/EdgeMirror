/**
 * Resource limits for remote runs and captured HTTP bodies.
 */

export const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const DEFAULT_MAX_REQUEST_BODY_BYTES = 512 * 1024; // 512 KiB
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_REMOTE_RUNS = 200;
export const DEFAULT_MAX_REMOTE_DURATION_MINUTES = 15;
/** Absolute ceiling — config cannot raise budgets above this without code change. */
export const HARD_MAX_REMOTE_RUNS = 1_000;
export const HARD_MAX_REMOTE_DURATION_MINUTES = 60;

export interface TruncationResult {
  text: string;
  truncated: boolean;
  originalBytes: number;
}

export function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function truncateToBytes(
  text: string,
  maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES,
): TruncationResult {
  const originalBytes = utf8ByteLength(text);
  if (originalBytes <= maxBytes) {
    return { text, truncated: false, originalBytes };
  }
  // Walk back to a valid UTF-8 boundary.
  let end = maxBytes;
  const buf = Buffer.from(text, "utf8");
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  const sliced = buf.subarray(0, end).toString("utf8");
  return {
    text: `${sliced}\n…[truncated ${originalBytes - end} bytes]`,
    truncated: true,
    originalBytes,
  };
}

export function clampRemoteBudget(input: {
  maxRuns: number;
  maxDurationMinutes: number;
}): { maxRuns: number; maxDurationMinutes: number } {
  return {
    maxRuns: Math.min(Math.max(1, Math.floor(input.maxRuns)), HARD_MAX_REMOTE_RUNS),
    maxDurationMinutes: Math.min(
      Math.max(1, input.maxDurationMinutes),
      HARD_MAX_REMOTE_DURATION_MINUTES,
    ),
  };
}

export function assertRequestBodySize(
  body: string | undefined,
  maxBytes: number = DEFAULT_MAX_REQUEST_BODY_BYTES,
): void {
  if (body === undefined) return;
  const size = utf8ByteLength(body);
  if (size > maxBytes) {
    throw new Error(
      `Request body exceeds limit (${size} > ${maxBytes} bytes)`,
    );
  }
}
