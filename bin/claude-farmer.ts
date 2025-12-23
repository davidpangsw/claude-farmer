#!/usr/bin/env node
/**
 * Claude Farmer CLI
 *
 * Farm your code with Claude tokens overnight.
 *
 * Usage:
 *   claude-farmer patch [working_directory] [options]
 *
 * Commands:
 *   patch  - Run Review → Develop → Commit cycle
 *
 * Options:
 *   --once               - Run once instead of looping
 *   --help               - Show this help message
 *
 * Working directory structure:
 *   <working_directory>/
 *   └── claude-farmer/
 *       ├── GOAL.md       # Human-written specification
 *       └── docs/         # Auto-generated markdown files
 */

import { join, resolve } from "path";
import { execSync } from "child_process";
import { promises as fsPromises } from "fs";
import { glob } from "fs/promises";
import { ClaudeCodeAI } from "../features/core/index.js";
import type { FileSystem } from "../features/core/index.js";
// Import tasks directly (internal to core feature)
import { review } from "../features/core/tasks/review/index.js";
import { develop } from "../features/core/tasks/develop/index.js";
import { createIterationLogger } from "../features/core/logging/index.js";

// Node.js file system implementation
class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return fsPromises.readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fsPromises.writeFile(path, content, "utf-8");
  }

  async appendFile(path: string, content: string): Promise<void> {
    await fsPromises.appendFile(path, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fsPromises.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    const globPattern = pattern || "**/*.ts";
    const fullPattern = join(directory, globPattern);
    const files: string[] = [];

    try {
      for await (const entry of glob(fullPattern)) {
        files.push(entry);
      }
    } catch {
      // Directory doesn't exist or no matches
    }

    return files;
  }

  async mkdir(path: string): Promise<void> {
    await fsPromises.mkdir(path, { recursive: true });
  }

  async deleteFile(path: string): Promise<void> {
    await fsPromises.unlink(path);
  }
}

function printHelp(): void {
  console.log(`
Claude Farmer - Farm your code with Claude tokens overnight

Usage:
  claude-farmer patch [working_directory] [options]

Commands:
  patch   Run Review → Develop → Commit cycle

Options:
  --once               Run once instead of looping (default: loop forever)
  --ultrathink         Enable extended thinking mode (default: off)
  --help               Show this help message

Examples:
  claude-farmer patch                           # Use current directory
  claude-farmer patch ./features/myfeature      # Specify working directory
  claude-farmer patch --once                    # Run single iteration
`);
}

async function runPatch(
  workingDir: string,
  projectRoot: string,
  fs: FileSystem,
  ai: ClaudeCodeAI,
  loop: boolean
): Promise<void> {
  let iterations = 0;

  do {
    iterations++;
    const logger = createIterationLogger(workingDir, fs, iterations);

    if (loop) {
      console.log(`\n=== Iteration ${iterations} ===`);
    }

    try {
      // Step 1: Review
      console.log("\n[1/3] Running review...");
      logger.log("Starting review task");
      const reviewResult = await review(workingDir, fs, ai);
      console.log(`Review written to: ${reviewResult.reviewPath}`);
      logger.logReview(reviewResult.reviewPath, reviewResult.content.length);

      // Step 2: Develop
      console.log("\n[2/3] Running develop...");
      logger.log("Starting develop task");
      const developResult = await develop(workingDir, fs, ai);
      console.log(`Applied ${developResult.edits.length} file edits`);
      for (const edit of developResult.edits) {
        console.log(`  - ${edit.path}`);
      }
      logger.logDevelop(developResult.edits);

      // Step 3: Commit
      console.log("\n[3/3] Committing changes...");
      logger.log("Starting commit");
      try {
        // Stage all changes
        execSync("git add -A", { cwd: projectRoot, encoding: "utf-8" });

        // Check if there are changes to commit
        const status = execSync("git status --porcelain", {
          cwd: projectRoot,
          encoding: "utf-8",
        });

        if (status.trim()) {
          // Commit with meaningful message
          const message = `claude-farmer: iteration ${iterations}`;
          execSync(`git commit -m "${message}"`, {
            cwd: projectRoot,
            encoding: "utf-8",
          });
          console.log(`Committed: ${message}`);
          logger.logCommit(message);
        } else {
          console.log("No changes to commit.");
          logger.logNoChanges();
        }
      } catch (error) {
        if (error instanceof Error && "stderr" in error) {
          console.error((error as { stderr: string }).stderr);
        }
        logger.logError("Failed to commit changes");
        throw new Error("Failed to commit changes");
      }

      // Finalize log for this iteration
      const logPath = await logger.finalize();
      console.log(`Log written to: ${logPath}`);

      // Check if we should continue looping
      if (developResult.edits.length === 0) {
        console.log("\nNo more changes needed.");
        break;
      }
    } catch (error) {
      logger.logError(error instanceof Error ? error.message : String(error));
      await logger.finalize();
      throw error;
    }
  } while (loop);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  if (command !== "patch") {
    console.error(`Error: Unknown command "${command}"`);
    console.error("Available commands: patch");
    process.exit(1);
  }

  // Parse arguments - working_directory is optional positional arg after command
  let workingDirArg: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      workingDirArg = args[i];
      break;
    }
  }

  const once = args.includes("--once");
  const ultrathink = args.includes("--ultrathink");
  const loop = !once; // Default is loop forever

  // Resolve working directory (default to current directory)
  const workingDir = workingDirArg ? resolve(workingDirArg) : process.cwd();

  // Determine project root (current directory where git repo is)
  const projectRoot = process.cwd();

  const fs = new NodeFileSystem();

  const ai = new ClaudeCodeAI({
    cwd: workingDir,
    ultrathink,
  });

  console.log(`Claude Farmer - Patch command`);
  console.log(`Working directory: ${workingDir}`);
  console.log(`Mode: ${loop ? "loop" : "once"}${ultrathink ? ", ultrathink" : ""}`);

  try {
    await runPatch(workingDir, projectRoot, fs, ai, loop);
    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
