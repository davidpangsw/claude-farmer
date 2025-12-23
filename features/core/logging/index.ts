/**
 * Logging utility for claude-farmer iterations.
 *
 * Creates timestamped log files in `<working_dir>/claude-farmer/logs/`
 * and maintains rotation to keep only the last 100 iterations.
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
 */
export class IterationLogger {
  private lines: string[] = [];
  private startTime: Date;

  constructor(
    private workingDirPath: string,
    private fs: FileSystem,
    private iteration: number
  ) {
    this.startTime = new Date();
    this.log(`=== Iteration ${iteration} started at ${this.startTime.toISOString()} ===`);
  }

  /**
   * Logs a message with timestamp.
   */
  log(message: string): void {
    const timestamp = new Date().toISOString();
    this.lines.push(`[${timestamp}] ${message}`);
  }

  /**
   * Logs the review task completion.
   */
  logReview(reviewPath: string, contentLength: number): void {
    this.log(`Review completed: ${reviewPath} (${contentLength} chars)`);
  }

  /**
   * Logs the develop task completion.
   */
  logDevelop(edits: Array<{ path: string; content: string }>): void {
    this.log(`Develop completed: ${edits.length} file(s) edited`);
    for (const edit of edits) {
      this.log(`  - ${edit.path} (${edit.content.length} chars)`);
    }
  }

  /**
   * Logs commit information.
   */
  logCommit(message: string): void {
    this.log(`Committed: ${message}`);
  }

  /**
   * Logs that no changes were committed.
   */
  logNoChanges(): void {
    this.log("No changes to commit");
  }

  /**
   * Logs an error.
   */
  logError(error: string): void {
    this.log(`ERROR: ${error}`);
  }

  /**
   * Finalizes the log and writes it to disk.
   * Also performs log rotation to keep only the last 100 files.
   */
  async finalize(): Promise<string> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    this.log(`=== Iteration ${this.iteration} completed in ${duration}ms ===`);

    const logsDir = join(this.workingDirPath, LOGS_DIR);
    await this.fs.mkdir(logsDir);

    const timestamp = getTimestamp();
    const logPath = join(logsDir, `${timestamp}.log`);
    const content = this.lines.join("\n") + "\n";

    await this.fs.writeFile(logPath, content);

    // Rotate logs - keep only the last MAX_LOG_FILES
    await this.rotateLogs(logsDir);

    return logPath;
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
