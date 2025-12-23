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
import { createIterationLogger, IterationLogger } from "../../logging/index.js";
import type { FileSystem, AIModel } from "../../types.js";

/** Minimum sleep duration: 1 minute */
const MIN_SLEEP_MS = 60 * 1000;
/** Maximum sleep duration: 24 hours */
const MAX_SLEEP_MS = 24 * 60 * 60 * 1000;
/** Maximum retries for transient errors before giving up */
const MAX_ERROR_RETRIES = 3;

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
 * Executes a shell script and captures its output.
 *
 * @param scriptPath - Path to the script to execute
 * @param cwd - Working directory for execution
 * @param args - Optional arguments to pass to the script
 * @param logger - Optional logger to capture output
 * @returns The script's stdout output
 */
function executeScript(
  scriptPath: string,
  cwd: string,
  args: string[] = [],
  logger?: IterationLogger
): string {
  const argsStr = args.length > 0 ? " " + args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(" ") : "";
  const command = `bash "${scriptPath}"${argsStr}`;

  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Log script output if logger provided
    if (logger && output.trim()) {
      // Use void to handle the promise without blocking
      void logger.log(`Script output: ${output.trim()}`);
    }

    return output;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message: string };
    const stderr = execError.stderr ?? "";
    const stdout = execError.stdout ?? "";

    // Log error output
    if (logger) {
      if (stderr.trim()) {
        void logger.log(`Script stderr: ${stderr.trim()}`);
      }
      if (stdout.trim()) {
        void logger.log(`Script stdout: ${stdout.trim()}`);
      }
    }

    throw error;
  }
}

/**
 * Checks if an error is likely transient and can be retried.
 */
function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("502")
  );
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
  let consecutiveErrors = 0;
  const sleep = options._sleepFn ?? defaultSleep;

  // Default scripts directory is relative to this module
  const scriptsDir = options.scriptsDir ?? join(import.meta.dirname, "../../scripts");

  do {
    iterations++;
    const logger = createIterationLogger(workingDirPath, fs, iterations);

    try {
      // Prepare for patch iteration
      executeScript(join(scriptsDir, "git-patch-checkout.sh"), workingDirPath, [], logger);

      // Run review first, then develop based on review feedback
      const reviewResult = await review(workingDirPath, fs, ai);
      await logger.logReview(reviewResult.reviewPath, reviewResult.content.length);

      const developResult = await develop(workingDirPath, fs, ai);
      await logger.logDevelop(developResult.edits);

      // Reset error counter on successful AI calls
      consecutiveErrors = 0;

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

        executeScript(
          join(scriptsDir, "git-patch-complete.sh"),
          workingDirPath,
          [commitMessage],
          logger
        );
        await logger.logCommit(commitMessage);

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
      const err = error instanceof Error ? error : new Error(String(error));
      await logger.logError(err.message);
      await logger.finalize();

      // Check if error is transient and we should retry
      if (!options.once && isTransientError(err)) {
        consecutiveErrors++;

        if (consecutiveErrors < MAX_ERROR_RETRIES) {
          // Use exponential backoff for retries
          const retryDelay = sleepMs * consecutiveErrors;
          await logger.log(`Transient error, retrying in ${retryDelay / 1000}s (attempt ${consecutiveErrors}/${MAX_ERROR_RETRIES})`);
          await sleep(retryDelay);
          continue;
        }
      }

      // Non-transient error or max retries exceeded - rethrow
      throw error;
    }
  } while (!options.once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
