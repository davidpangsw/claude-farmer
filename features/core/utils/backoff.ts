/**
 * Shared backoff utilities for exponential retry logic.
 */

/** Minimum sleep duration: 1 minute */
export const MIN_SLEEP_MS = 60 * 1000;

/** Maximum sleep duration: 2 hours */
export const MAX_SLEEP_MS = 2 * 60 * 60 * 1000;

/**
 * Format milliseconds for human-readable display.
 */
export function formatDuration(ms: number): string {
  return ms >= 60000
    ? `${Math.round(ms / 60000)} minute(s)`
    : `${Math.round(ms / 1000)} second(s)`;
}

/**
 * Calculate the next backoff duration (doubles, capped at MAX_SLEEP_MS).
 */
export function nextBackoff(currentMs: number): number {
  return Math.min(currentMs * 2, MAX_SLEEP_MS);
}

/**
 * Default sleep function using setTimeout.
 */
export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error message indicates a rate limit.
 */
export function isRateLimitError(message: string): boolean {
  return (
    message.includes("Spending cap reached") ||
    message.includes("You've hit your limit")
  );
}

/**
 * Logger interface for backoff operations.
 */
export interface BackoffLogger {
  log(message: string): void;
  finalize(): void;
}

/**
 * Perform backoff sleep with logging.
 * Logs the reason, sleep duration, finalizes the logger, sleeps, and returns the next backoff value.
 */
export async function performBackoffSleep(
  logger: BackoffLogger,
  currentSleepMs: number,
  reason: string,
  sleep: (ms: number) => Promise<void>
): Promise<number> {
  logger.log(reason);
  logger.log(`Sleeping for ${formatDuration(currentSleepMs)} before retry...`);
  logger.finalize();
  await sleep(currentSleepMs);
  return nextBackoff(currentSleepMs);
}
