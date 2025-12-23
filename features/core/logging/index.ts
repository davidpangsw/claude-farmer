/**
 * Logging utility for claude-farmer iterations.
 * Uses pino for logging and rotating-file-stream for file rotation per GOAL.md.
 */

import pino from "pino";
import rfs from "rotating-file-stream";
import { mkdirSync } from "fs";
import { join } from "path";

const MAX_LOG_FILES = 30;
const LOGS_DIR = "claude-farmer/logs";

interface CachedStream {
  stream: rfs.RotatingFileStream;
  iterationCount: number;
}

// Cache streams per logs directory to maintain rotation tracking across iterations
const streamCache = new Map<string, CachedStream>();

/**
 * Format current OS time as YYYYMMDD_HHmmss.
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Get or create a rotating file stream for the given logs directory.
 * Rotates the stream for each new iteration to create a new timestamped file.
 */
function getOrCreateStream(logsDir: string, iteration: number): rfs.RotatingFileStream {
  let cached = streamCache.get(logsDir);

  if (!cached) {
    // Create filename generator that uses OS timestamps
    const generator = (time: Date | null): string => {
      const now = time || new Date();
      return `${formatTimestamp(now)}.log`;
    };

    const stream = rfs.createStream(generator, {
      path: logsDir,
      maxFiles: MAX_LOG_FILES,
    });

    cached = { stream, iterationCount: iteration };
    streamCache.set(logsDir, cached);
  } else if (iteration > cached.iterationCount) {
    // New iteration - rotate to create a new timestamped file
    cached.stream.rotate();
    cached.iterationCount = iteration;
  }

  return cached.stream;
}

export class IterationLogger {
  private logger: pino.Logger;

  constructor(workingDirPath: string, private iteration: number) {
    const logsDir = join(workingDirPath, LOGS_DIR);
    mkdirSync(logsDir, { recursive: true });

    const stream = getOrCreateStream(logsDir, iteration);

    // Create pino logger writing to the rotating stream
    // Include timestamp in log messages per GOAL.md
    // Use sync: true to ensure real-time streaming without buffering per GOAL.md
    this.logger = pino(
      { timestamp: pino.stdTimeFunctions.isoTime, sync: true },
      stream
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
