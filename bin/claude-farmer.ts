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
 *   patch  - Run Review → Develop cycle with git versioning
 *
 * Options:
 *   --trunk <branch>     - Trunk branch to branch from (default: develop)
 *   --checkout <branch>  - Feature branch to work on (default: features/<working_directory_name>)
 *   --once               - Run once instead of looping
 *   --help               - Show this help message
 *
 * Working directory structure:
 *   <working_directory>/
 *   └── claude-farmer/
 *       ├── GOAL.md       # Human-written specification
 *       └── docs/         # Markdown files for AI to read/write
 */

import { join, basename, resolve } from "path";
import { execSync } from "child_process";
import { promises as fsPromises } from "fs";
import { glob } from "fs/promises";
import { ClaudeCodeAI } from "../features/core/index.js";
import type { FileSystem } from "../features/core/index.js";
// Import tasks directly (internal to core feature)
import { review } from "../features/core/tasks/review/index.js";
import { develop } from "../features/core/tasks/develop/index.js";

// Node.js file system implementation
class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return fsPromises.readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fsPromises.writeFile(path, content, "utf-8");
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
}

function printHelp(): void {
  console.log(`
Claude Farmer - Farm your code with Claude tokens overnight

Usage:
  claude-farmer patch [working_directory] [options]

Commands:
  patch   Run Review → Develop cycle with git versioning

Options:
  --trunk <branch>     Trunk branch to branch from (default: develop)
  --checkout <branch>  Feature branch to work on (default: features/<working_directory_name>)
  --once               Run once instead of looping (default: loop)
  --help               Show this help message

Examples:
  claude-farmer patch                           # Use current directory
  claude-farmer patch ./features/myfeature      # Specify working directory
  claude-farmer patch --trunk main              # Use main as trunk branch
  claude-farmer patch --checkout my-branch      # Use custom feature branch
  claude-farmer patch --once                    # Run single iteration
`);
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

async function runPatch(
  workingDir: string,
  branchName: string,
  projectRoot: string,
  fs: FileSystem,
  ai: ClaudeCodeAI,
  loop: boolean
): Promise<void> {
  const scriptsDir = join(projectRoot, "features", "core", "scripts");
  const checkoutScript = join(scriptsDir, "git-patch-checkout.sh");
  const completeScript = join(scriptsDir, "git-patch-complete.sh");

  const maxIterations = loop ? 10 : 1;
  let iterations = 0;

  do {
    iterations++;
    if (loop) {
      console.log(`\n=== Iteration ${iterations} ===`);
    }

    // Step 1: Git checkout (create patch branch)
    console.log("\n[1/4] Creating patch branch...");
    try {
      const checkoutOutput = execSync(`bash "${checkoutScript}" "${branchName}"`, {
        cwd: projectRoot,
        encoding: "utf-8",
      });
      console.log(checkoutOutput);
    } catch (error) {
      if (error instanceof Error && "stderr" in error) {
        console.error((error as { stderr: string }).stderr);
      }
      throw new Error("Failed to create patch branch");
    }

    // Step 2: Review
    console.log("\n[2/4] Running review...");
    const reviewResult = await review(workingDir, fs, ai);
    console.log(`Review written to: ${reviewResult.reviewPath}`);

    // Step 3: Develop
    console.log("\n[3/4] Running develop...");
    const developResult = await develop(workingDir, fs, ai);
    console.log(`Applied ${developResult.edits.length} file edits`);
    for (const edit of developResult.edits) {
      console.log(`  - ${edit.path}`);
    }

    // Step 4: Git complete (commit, merge, tag)
    console.log("\n[4/4] Completing patch...");
    try {
      const completeOutput = execSync(
        `bash "${completeScript}" "${branchName}" "Auto-generated patch"`,
        {
          cwd: projectRoot,
          encoding: "utf-8",
        }
      );
      console.log(completeOutput);
    } catch (error) {
      if (error instanceof Error && "stderr" in error) {
        console.error((error as { stderr: string }).stderr);
      }
      throw new Error("Failed to complete patch");
    }

    // Check if we should continue looping
    if (developResult.edits.length === 0) {
      console.log("\nNo more changes needed.");
      break;
    }
  } while (loop && iterations < maxIterations);
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
  // It's the first non-flag argument after "patch"
  let workingDirArg: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      workingDirArg = args[i];
      break;
    } else if (args[i] === "--trunk" || args[i] === "--checkout") {
      i++; // Skip the value of these flags
    }
  }

  const trunk = getArgValue(args, "--trunk") || "develop";
  const once = args.includes("--once");
  const loop = !once; // Default is loop

  // Resolve working directory (default to current directory)
  const workingDir = workingDirArg ? resolve(workingDirArg) : process.cwd();
  const workingDirName = basename(workingDir);

  // Feature branch name (default: features/<working_directory_name>)
  const branchName = getArgValue(args, "--checkout") || `features/${workingDirName}`;

  // Determine project root (current directory where git repo is)
  const projectRoot = process.cwd();

  const fs = new NodeFileSystem();
  const tasksDir = join(projectRoot, "features", "core", "tasks");

  const ai = new ClaudeCodeAI({
    cwd: workingDir,
    ultrathink: true,
    tasksDir,
    fs,
  });

  console.log(`Claude Farmer - Patch command`);
  console.log(`Working directory: ${workingDir}`);
  console.log(`Feature branch: ${branchName}`);
  console.log(`Trunk: ${trunk}`);
  console.log(`Mode: ${loop ? "loop" : "once"}`);

  try {
    await runPatch(workingDir, branchName, projectRoot, fs, ai, loop);
    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
