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

import { execSync, spawnSync } from "child_process";
import { basename } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import { createIterationLogger } from "../../logging/index.js";
import type { AIModel } from "../../types.js";

/** Minimum sleep duration: 1 minute */
const MIN_SLEEP_MS = 60 * 1000;
/** Maximum sleep duration: 2 hours */
const MAX_SLEEP_MS = 2 * 60 * 60 * 1000;

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
      logger.log(`Review completed: ${reviewResult.reviewPath} (${reviewResult.content.length} chars)`);

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

        // Git add and commit using spawn with args array for safer handling
        execSync("git add -A", {
          cwd: workingDirPath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

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
      } else {
        logger.log("No changes to commit");

        // Exponential backoff: sleep and retry
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
      if (err.message.indexOf("Spending cap reached") !== -1 || err.message.indexOf("You've hit your limit") !== -1) {
        logger.log("Spending cap reached");

        // Exponential backoff: sleep and retry
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
  } while (!options.once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
