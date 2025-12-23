/**
 * Develop command implementation.
 *
 * Runs the develop task with optional looping behavior.
 * Uses exponential backoff (1→2→4→8 min... max 2h) when no changes.
 */

import { basename } from "path";
import { develop as developTask } from "../../tasks/develop/index.js";
import { createIterationLogger } from "../../logging/index.js";
import type { AIModel, DevelopResult } from "../../types.js";

/** Minimum sleep duration: 1 minute */
const MIN_SLEEP_MS = 60 * 1000;
/** Maximum sleep duration: 2 hours */
const MAX_SLEEP_MS = 2 * 60 * 60 * 1000;

export interface DevelopOptions {
  /** Run once instead of looping (default: true) */
  once?: boolean;
  /** Enable ultrathink mode for AI (extended thinking) */
  ultrathink?: boolean;
  /** @internal For testing - custom sleep function */
  _sleepFn?: (ms: number) => Promise<void>;
}

export interface DevelopCommandResult {
  workingDirName: string;
  iterations: number;
  lastResult: DevelopResult;
}

/**
 * Default sleep function using setTimeout.
 */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes the develop command for a working directory.
 */
export async function develop(
  workingDirPath: string,
  ai: AIModel,
  options: DevelopOptions = {}
): Promise<DevelopCommandResult> {
  // Default to once=true per GOAL.md
  const once = options.once ?? true;
  let iterations = 0;
  let sleepMs = MIN_SLEEP_MS;
  const sleep = options._sleepFn ?? defaultSleep;
  let lastResult: DevelopResult = { workingDirName: basename(workingDirPath), edits: [] };

  do {
    iterations++;
    const logger = createIterationLogger(workingDirPath, iterations);

    try {
      lastResult = await developTask(workingDirPath, ai);
      logger.log(`Develop completed: ${lastResult.edits.length} file(s) edited`);
      for (const edit of lastResult.edits) {
        logger.log(`  - ${edit.path} (${edit.content.length} chars)`);
      }

      // Log security warnings if any
      if (lastResult.warnings && lastResult.warnings.length > 0) {
        for (const warning of lastResult.warnings) {
          logger.error(`[SECURITY] ${warning}`);
        }
      }

      if (lastResult.edits.length > 0) {
        // Reset backoff on successful edits
        sleepMs = MIN_SLEEP_MS;
      } else if (!once) {
        // No changes and looping - apply backoff
        logger.log("No changes made");
        const display = sleepMs >= 60000
          ? `${Math.round(sleepMs / 60000)} minute(s)`
          : `${Math.round(sleepMs / 1000)} second(s)`;
        logger.log(`Sleeping for ${display} before retry...`);
        logger.finalize();
        await sleep(sleepMs);
        sleepMs = Math.min(sleepMs * 2, MAX_SLEEP_MS);
        continue;
      }

      logger.finalize();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err.message);

      // Handle rate limits with exponential backoff
      if (
        err.message.includes("Spending cap reached") ||
        err.message.includes("You've hit your limit")
      ) {
        logger.log("Spending cap reached");
        const display = sleepMs >= 60000
          ? `${Math.round(sleepMs / 60000)} minute(s)`
          : `${Math.round(sleepMs / 1000)} second(s)`;
        logger.log(`Sleeping for ${display} before retry...`);
        logger.finalize();
        await sleep(sleepMs);
        sleepMs = Math.min(sleepMs * 2, MAX_SLEEP_MS);
        continue;
      } else {
        logger.finalize();
        throw error;
      }
    }
  } while (!once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
    lastResult,
  };
}
