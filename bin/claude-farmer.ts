#!/usr/bin/env node
/**
 * Claude Farmer CLI
 *
 * Farm your code with Claude tokens overnight.
 *
 * Usage:
 *   claude-farmer patch <feature> [options]
 *
 * Commands:
 *   patch  - Run Review → Develop cycle with git versioning
 *
 * Options:
 *   --trunk <branch>  - Trunk branch (default: develop)
 *   --once            - Run once instead of looping
 *   --help            - Show this help message
 */

import { join } from "path";
import { execSync } from "child_process";
import { promises as fsPromises } from "fs";
import { glob } from "fs/promises";
import { ClaudeCodeAI } from "../features/core/index.js";
import type { FileSystem, CoreConfig } from "../features/core/index.js";
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
  claude-farmer patch <feature> [options]

Commands:
  patch   Run Review → Develop cycle with git versioning

Options:
  --trunk <branch>  Trunk branch (default: develop)
  --once            Run once instead of looping (default: loop)
  --help            Show this help message

Examples:
  claude-farmer patch core
  claude-farmer patch core --trunk main
  claude-farmer patch core --once
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
  featureName: string,
  projectRoot: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: ClaudeCodeAI,
  loop: boolean
): Promise<void> {
  const commandsDir = join(projectRoot, "features", "core", "commands");
  const checkoutScript = join(commandsDir, "git-patch-checkout.sh");
  const completeScript = join(commandsDir, "git-patch-complete.sh");

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
      const checkoutOutput = execSync(`bash "${checkoutScript}" "${featureName}"`, {
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
    const reviewResult = await review(featureName, config, fs, ai);
    console.log(`Review written to: ${reviewResult.reviewPath}`);

    // Step 3: Develop
    console.log("\n[3/4] Running develop...");
    const developResult = await develop(featureName, config, fs, ai);
    console.log(`Applied ${developResult.edits.length} file edits`);
    for (const edit of developResult.edits) {
      console.log(`  - ${edit.path}`);
    }

    // Step 4: Git complete (commit, merge, tag)
    console.log("\n[4/4] Completing patch...");
    try {
      const completeOutput = execSync(
        `bash "${completeScript}" "${featureName}" "Auto-generated patch"`,
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
  const featureName = args[1];
  const trunk = getArgValue(args, "--trunk") || "develop";
  const once = args.includes("--once");
  const loop = !once; // Default is loop

  if (command !== "patch") {
    console.error(`Error: Unknown command "${command}"`);
    console.error("Available commands: patch");
    process.exit(1);
  }

  if (!featureName) {
    console.error("Error: Feature name required");
    printHelp();
    process.exit(1);
  }

  // Determine project root (current directory)
  const projectRoot = process.cwd();
  const config: CoreConfig = {
    projectRoot,
    featuresDir: join(projectRoot, "features"),
  };

  const fs = new NodeFileSystem();
  const tasksDir = join(projectRoot, "features", "core", "tasks");

  const ai = new ClaudeCodeAI({
    cwd: projectRoot,
    ultrathink: true,
    tasksDir,
    fs,
  });

  console.log(`Claude Farmer - Patch command`);
  console.log(`Feature: ${featureName}`);
  console.log(`Trunk: ${trunk}`);
  console.log(`Mode: ${loop ? "loop" : "once"}`);

  try {
    await runPatch(featureName, projectRoot, config, fs, ai, loop);
    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
