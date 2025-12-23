/**
 * Patch command implementation.
 *
 * Orchestrates the patch workflow:
 * 1. Perform Review
 * 2. Perform Develop
 * 3. Commit with meaningful message
 *
 * Supports loop mode (default) and --once flag.
 * When no edits are made, uses exponential backoff (1→2→4→8 min... max 24h).
 */

import { execSync } from "child_process";
import { join, basename } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import { createIterationLogger } from "../../logging/index.js";
import type { FileSystem, AIModel } from "../../types.js";

/** Minimum sleep duration: 1 minute */
const MIN_SLEEP_MS = 60 * 1000;
/** Maximum sleep duration: 24 hours */
const MAX_SLEEP_MS = 24 * 60 * 60 * 1000;

export interface PatchOptions {
  once?: boolean;
  scriptsDir?: string;
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
 * Executes a shell script.
 */
function executeScript(scriptPath: string, cwd: string): void {
  execSync(`bash "${scriptPath}"`, {
    cwd,
    stdio: "inherit",
  });
}

/**
 * Executes the patch command for a working directory.
 *
 * @param workingDirPath - The path to the working directory
 * @param fs - File system interface
 * @param ai - AI model interface
 * @param options - Patch options including --once flag and optional scriptsDir
 */
export async function patch(
  workingDirPath: string,
  fs: FileSystem,
  ai: AIModel,
  options: PatchOptions = {}
): Promise<PatchResult> {
  let iterations = 0;
  let sleepMs = MIN_SLEEP_MS;
  const sleep = options._sleepFn ?? defaultSleep;

  // Default scripts directory is relative to this module
  const scriptsDir = options.scriptsDir ?? join(import.meta.dirname, "../../scripts");

  do {
    iterations++;
    const logger = createIterationLogger(workingDirPath, fs, iterations);

    try {
      // Prepare for patch iteration
      executeScript(join(scriptsDir, "git-patch-checkout.sh"), workingDirPath);

      // Run review first, then develop based on review feedback
      const reviewResult = await review(workingDirPath, fs, ai);
      await logger.logReview(reviewResult.reviewPath, reviewResult.content.length);

      const developResult = await develop(workingDirPath, fs, ai);
      await logger.logDevelop(developResult.edits);

      // Commit changes or handle no-edits case
      if (developResult.edits.length > 0) {
        executeScript(join(scriptsDir, "git-patch-complete.sh"), workingDirPath);
        await logger.logCommit(`Applied ${developResult.edits.length} edit(s)`);
        // Reset backoff on successful edits
        sleepMs = MIN_SLEEP_MS;
      } else {
        await logger.logNoChanges();

        // If --once flag, exit after this iteration
        if (options.once) {
          await logger.finalize();
          break;
        }

        // Exponential backoff: sleep and retry
        await logger.logSleep(sleepMs);
        await logger.finalize();
        await sleep(sleepMs);
        sleepMs = Math.min(sleepMs * 2, MAX_SLEEP_MS);
        continue;
      }

      await logger.finalize();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logger.logError(errorMessage);
      await logger.finalize();
      throw error;
    }
  } while (!options.once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
