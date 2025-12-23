/**
 * Develop command implementation.
 *
 * Runs the develop task with optional looping behavior.
 * Uses exponential backoff (1→2→4→8 min... max 2h) when no changes.
 */

import { basename } from "path";
import { develop as developTask } from "../../tasks/develop/index.js";
import { createIterationLogger, IterationLogger } from "../../logging/index.js";
import {
  MIN_SLEEP_MS,
  defaultSleep,
  isRateLimitError,
  performBackoffSleep,
} from "../../utils/index.js";
import type { AIModel, DevelopResult } from "../../types.js";

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
  let currentLogger: IterationLogger | null = null;
  let shuttingDown = false;

  // Graceful shutdown handler with flag-based approach
  const shutdownHandler = () => {
    if (shuttingDown) {
      // Second signal - force exit
      process.exit(1);
    }
    shuttingDown = true;
    if (currentLogger) {
      currentLogger.error("Received shutdown signal");
      currentLogger.finalize();
      currentLogger = null;
    }
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);

  try {
    do {
      if (shuttingDown) break;

      iterations++;
      const logger = createIterationLogger(workingDirPath, iterations);
      currentLogger = logger;

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
          logger.finalize();
          currentLogger = null;
        } else if (!once) {
          // No changes and looping - apply backoff
          sleepMs = await performBackoffSleep(logger, sleepMs, "No changes made", sleep);
          currentLogger = null;
          continue;
        } else {
          logger.finalize();
          currentLogger = null;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(err.message);

        // Handle rate limits with exponential backoff
        if (isRateLimitError(err.message)) {
          sleepMs = await performBackoffSleep(logger, sleepMs, "Spending cap reached", sleep);
          currentLogger = null;
          continue;
        } else {
          logger.finalize();
          currentLogger = null;
          throw error;
        }
      }
    } while (!once && !shuttingDown);
  } finally {
    // Clean up signal handlers
    process.off("SIGINT", shutdownHandler);
    process.off("SIGTERM", shutdownHandler);
  }

  return {
    workingDirName: basename(workingDirPath),
    iterations,
    lastResult,
  };
}
