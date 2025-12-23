/**
 * Patch command implementation.
 *
 * Orchestrates the patch workflow:
 * 1. Perform Review
 * 2. Perform Develop
 * 3. Commit with meaningful message
 *
 * Loop forever by default. Uses exponential backoff (1→2→4→8 min... max 24h) when no changes.
 */

import { execSync } from "child_process";
import { basename } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import { createIterationLogger } from "../../logging/index.js";
import type { AIModel } from "../../types.js";

/** Minimum sleep duration: 1 minute */
const MIN_SLEEP_MS = 60 * 1000;
/** Maximum sleep duration: 24 hours */
const MAX_SLEEP_MS = 24 * 60 * 60 * 1000;

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
 * Default sleep function using setTimeout.
 */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  do {
    iterations++;
    const logger = createIterationLogger(workingDirPath, iterations);

    try {
      // Run review first, then develop based on review feedback
      const reviewResult = await review(workingDirPath, ai);
      await logger.logReview(reviewResult.reviewPath, reviewResult.content.length);

      const developResult = await develop(workingDirPath, ai);
      await logger.logDevelop(developResult.edits);

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

        // Git add and commit
        execSync(`git add -A && git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: workingDirPath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        await logger.logCommit(commitMessage);

        // Reset backoff on successful edits
        sleepMs = MIN_SLEEP_MS;
      } else {
        await logger.logNoChanges();

        // Exponential backoff: sleep and retry
        await logger.logSleep(sleepMs);
        await logger.finalize();
        await sleep(sleepMs);
        sleepMs = Math.min(sleepMs * 2, MAX_SLEEP_MS);
        continue;
      }

      await logger.finalize();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await logger.logError(err.message);
      await logger.finalize();
      throw error;
    }
  } while (!options.once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
