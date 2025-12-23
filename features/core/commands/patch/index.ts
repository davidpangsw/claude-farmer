/**
 * Patch command implementation.
 *
 * Orchestrates the patch workflow:
 * 1. Perform Review
 * 2. Perform Develop
 * 3. Commit with meaningful message
 *
 * Supports loop mode (default) and --once flag.
 */

import { execSync } from "child_process";
import { join, basename } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import { createIterationLogger } from "../../logging/index.js";
import type { FileSystem, AIModel } from "../../types.js";

export interface PatchOptions {
  once?: boolean;
  scriptsDir?: string;
}

export interface PatchResult {
  workingDirName: string;
  iterations: number;
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
      logger.logReview(reviewResult.reviewPath, reviewResult.content.length);

      const developResult = await develop(workingDirPath, fs, ai);
      logger.logDevelop(developResult.edits);

      // Commit changes
      if (developResult.edits.length > 0) {
        executeScript(join(scriptsDir, "git-patch-complete.sh"), workingDirPath);
        logger.logCommit(`Applied ${developResult.edits.length} edit(s)`);
      } else {
        logger.logNoChanges();
      }

      await logger.finalize();

      // Stop if no edits were made (nothing more to do)
      if (developResult.edits.length === 0) {
        break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.logError(errorMessage);
      await logger.finalize();
      throw error;
    }
  } while (!options.once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
