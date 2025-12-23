/**
 * Logging utility for claude-farmer iterations.
 * Uses pino with sync destination for real-time logging.
 */

import pino from "pino";
import { globSync } from "glob";
import { mkdirSync, unlinkSync, statSync } from "fs";
import { join } from "path";

const MAX_LOG_FILES = 30;
const LOGS_DIR = "claude-farmer/logs";

/**
 * Clean up old log files, keeping only the most recent ones.
 * Uses glob library for file discovery.
 */
function cleanupOldLogs(logsDir: string, maxFiles: number): void {
  try {
    const files = globSync("*.log", { cwd: logsDir })
      .map(f => ({
        name: f,
        time: statSync(join(logsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time)
      .slice(maxFiles);

    for (const file of files) {
      try {
        unlinkSync(join(logsDir, file.name));
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch {
    // Ignore if directory doesn't exist or other errors
  }
}

/**
 * Format current OS time as YYYYMMDD_HHmmss.
 */
function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

export class IterationLogger {
  private logger: pino.Logger;

  constructor(workingDirPath: string, private iteration: number) {
    const logsDir = join(workingDirPath, LOGS_DIR);
    mkdirSync(logsDir, { recursive: true });

    // Clean up old log files using glob library
    cleanupOldLogs(logsDir, MAX_LOG_FILES);

    // Generate filename with OS local time
    const ts = formatTimestamp();
    const logPath = join(logsDir, `${ts}.log`);

    // Create sync destination for real-time streaming (no buffering)
    // Include timestamp in log messages per GOAL.md
    this.logger = pino(
      { timestamp: pino.stdTimeFunctions.isoTime },
      pino.destination({ dest: logPath, sync: true })
    );

    this.logger.info(`=== Iteration ${iteration} started ===`);
  }

  log(message: string): void {
    this.logger.info(message);
  }

  error(message: string): void {
    this.logger.error(message);
  }

  finalize(): void {
    this.logger.info(`=== Iteration ${this.iteration} completed ===`);
  }
}

export function createIterationLogger(workingDirPath: string, iteration: number): IterationLogger {
  return new IterationLogger(workingDirPath, iteration);
}
