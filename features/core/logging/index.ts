/**
 * Logging utility for claude-farmer iterations.
 *
 * Creates timestamped log files in `<working_dir>/claude-farmer/logs/`
 * and maintains rotation to keep only the last 100 iterations.
 *
 * Logs are written IN REAL TIME - each log line is immediately appended to the file.
 */

import { join } from "path";
import type { FileSystem } from "../types.js";

const MAX_LOG_FILES = 100;
const LOGS_DIR = "claude-farmer/logs";

/**
 * Generates a timestamp string in YYYYMMDD_HHmmss format.
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Logger for a single iteration.
 * Writes logs in real-time - each log call immediately appends to the file.
 */
export class IterationLogger {
  private logPath: string;
  private startTime: Date;
  private initialized: boolean = false;

  constructor(
    private workingDirPath: string,
    private fs: FileSystem,
    private iteration: number
  ) {
    this.startTime = new Date();
    const timestamp = getTimestamp();
    this.logPath = join(this.workingDirPath, LOGS_DIR, `${timestamp}.log`);
  }

  /**
   * Ensures the log file is initialized (creates directory and file).
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const logsDir = join(this.workingDirPath, LOGS_DIR);
    await this.fs.mkdir(logsDir);

    // Write initial message
    const timestamp = this.startTime.toISOString();
    const message = `[${timestamp}] === Iteration ${this.iteration} started at ${timestamp} ===\n`;
    await this.fs.writeFile(this.logPath, message);

    this.initialized = true;
  }

  /**
   * Logs a message with timestamp. Writes immediately to file.
   */
  async log(message: string): Promise<void> {
    await this.ensureInitialized();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    await this.fs.appendFile(this.logPath, line);
  }

  /**
   * Logs the review task completion.
   */
  async logReview(reviewPath: string, contentLength: number): Promise<void> {
    await this.log(`Review completed: ${reviewPath} (${contentLength} chars)`);
  }

  /**
   * Logs the develop task completion.
   */
  async logDevelop(edits: Array<{ path: string; content: string }>): Promise<void> {
    await this.log(`Develop completed: ${edits.length} file(s) edited`);
    for (const edit of edits) {
      await this.log(`  - ${edit.path} (${edit.content.length} chars)`);
    }
  }

  /**
   * Logs commit information.
   */
  async logCommit(message: string): Promise<void> {
    await this.log(`Committed: ${message}`);
  }

  /**
   * Logs that no changes were committed.
   */
  async logNoChanges(): Promise<void> {
    await this.log("No changes to commit");
  }

  /**
   * Logs a sleep/backoff event.
   */
  async logSleep(durationMs: number): Promise<void> {
    const seconds = Math.round(durationMs / 1000);
    const minutes = Math.round(durationMs / 60000);
    const display = durationMs >= 60000 ? `${minutes} minute(s)` : `${seconds} second(s)`;
    await this.log(`Sleeping for ${display} before retry...`);
  }

  /**
   * Logs an error.
   */
  async logError(error: string): Promise<void> {
    await this.log(`ERROR: ${error}`);
  }

  /**
   * Finalizes the log and performs rotation.
   * Also performs log rotation to keep only the last 100 files.
   */
  async finalize(): Promise<string> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    await this.log(`=== Iteration ${this.iteration} completed in ${duration}ms ===`);

    // Rotate logs - keep only the last MAX_LOG_FILES
    const logsDir = join(this.workingDirPath, LOGS_DIR);
    await this.rotateLogs(logsDir);

    return this.logPath;
  }

  /**
   * Removes old log files, keeping only the most recent MAX_LOG_FILES.
   */
  private async rotateLogs(logsDir: string): Promise<void> {
    try {
      const logFiles = await this.fs.listFiles(logsDir, "*.log");

      if (logFiles.length <= MAX_LOG_FILES) {
        return;
      }

      // Sort by filename (which includes timestamp) - oldest first
      logFiles.sort();

      // Delete oldest files
      const filesToDelete = logFiles.slice(0, logFiles.length - MAX_LOG_FILES);
      for (const file of filesToDelete) {
        await this.fs.deleteFile(file);
      }
    } catch {
      // Ignore rotation errors - logging should not break the main workflow
    }
  }
}

/**
 * Creates a new iteration logger.
 */
export function createIterationLogger(
  workingDirPath: string,
  fs: FileSystem,
  iteration: number
): IterationLogger {
  return new IterationLogger(workingDirPath, fs, iteration);
}
