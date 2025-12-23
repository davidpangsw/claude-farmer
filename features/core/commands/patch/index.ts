/**
 * Patch command implementation.
 *
 * Orchestrates the patch workflow:
 * 1. Perform Review
 * 2. Perform Develop
 * 3. Commit with meaningful message
 *
 * Loop forever by default. Uses exponential backoff (1→2→4→8 min... max 2h) when no changes.
 */

import { spawnSync } from "child_process";
import { basename } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import { createIterationLogger, IterationLogger } from "../../logging/index.js";
import {
  MIN_SLEEP_MS,
  defaultSleep,
  isRateLimitError,
  performBackoffSleep,
} from "../../utils/index.js";
import type { AIModel } from "../../types.js";

export interface PatchOptions {
  /** Run once instead of looping */
  once?: boolean;
  /** Enable ultrathink mode for AI (extended thinking) */
  ultrathink?: boolean;
  /** @internal For testing - custom sleep function */
  _sleepFn?: (ms: number) => Promise<void>;
}

export interface PatchResult {
  workingDirName: string;
  iterations: number;
}

/**
 * Executes the patch command for a working directory.
 */
export async function patch(
  workingDirPath: string,
  ai: AIModel,
  options: PatchOptions = {}
): Promise<PatchResult> {
  let iterations = 0;
  let sleepMs = MIN_SLEEP_MS;
  const sleep = options._sleepFn ?? defaultSleep;
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
        // Run review first, then develop based on review feedback
        const reviewResult = await review(workingDirPath, ai);
        logger.log(`Review completed: ${reviewResult.reviewPath} (${reviewResult.content.length} chars)`);

        if (shuttingDown) break;

        const developResult = await develop(workingDirPath, ai);
        logger.log(`Develop completed: ${developResult.edits.length} file(s) edited`);
        for (const edit of developResult.edits) {
          logger.log(`  - ${edit.path} (${edit.content.length} chars)`);
        }

        // Log security warnings if any
        if (developResult.warnings && developResult.warnings.length > 0) {
          for (const warning of developResult.warnings) {
            logger.error(`[SECURITY] ${warning}`);
          }
        }

        // Commit changes or handle no-edits case
        if (developResult.edits.length > 0) {
          // Build meaningful commit message
          const fileCount = developResult.edits.length;
          const fileNames = developResult.edits
            .map(e => basename(e.path))
            .slice(0, 3)
            .join(", ");
          const suffix = fileCount > 3 ? ` and ${fileCount - 3} more` : "";
          const commitMessage = `claude-farmer: updated ${fileNames}${suffix}`;

          // Git add using spawnSync with error checking
          const addResult = spawnSync("git", ["add", "-A"], {
            cwd: workingDirPath,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          if (addResult.status !== 0) {
            throw new Error(`Git add failed: ${addResult.stderr || addResult.stdout}`);
          }

          const commitResult = spawnSync("git", ["commit", "-m", commitMessage], {
            cwd: workingDirPath,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          if (commitResult.status !== 0) {
            throw new Error(`Git commit failed: ${commitResult.stderr || commitResult.stdout}`);
          }

          logger.log(`Committed: ${commitMessage}`);

          // Reset backoff on successful edits
          sleepMs = MIN_SLEEP_MS;
          logger.finalize();
          currentLogger = null;
        } else {
          // No changes - apply backoff
          sleepMs = await performBackoffSleep(logger, sleepMs, "No changes to commit", sleep);
          currentLogger = null;
          continue;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(err.message);
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
    } while (!options.once && !shuttingDown);
  } finally {
    // Clean up signal handlers
    process.off("SIGINT", shutdownHandler);
    process.off("SIGTERM", shutdownHandler);
  }

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
