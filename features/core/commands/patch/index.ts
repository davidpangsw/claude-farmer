/**
 * Patch command implementation.
 *
 * Orchestrates the patch workflow:
 * 1. Execute git-patch-checkout.sh
 * 2. Perform Review
 * 3. Perform Develop
 * 4. Execute git-patch-complete.sh
 *
 * Supports loop mode (default) and --once flag.
 */

import { execSync } from "child_process";
import { join, basename } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import type { FileSystem, AIModel, CoreConfig } from "../../types.js";

export interface PatchOptions {
  once?: boolean;
}

export interface PatchResult {
  workingDirName: string;
  iterations: number;
}

/**
 * Executes a shell script in the scripts directory.
 */
function executeScript(
  scriptName: string,
  scriptsDir: string,
  projectRoot: string
): void {
  const scriptPath = join(scriptsDir, scriptName);
  execSync(`bash "${scriptPath}"`, {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

/**
 * Runs one iteration of the patch workflow.
 */
async function runPatchIteration(
  workingDirPath: string,
  fs: FileSystem,
  ai: AIModel
): Promise<void> {
  // Perform Review
  await review(workingDirPath, fs, ai);

  // Perform Develop
  await develop(workingDirPath, fs, ai);
}

/**
 * Executes the patch command for a working directory.
 */
export async function patch(
  workingDirPath: string,
  scriptsDir: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel,
  options: PatchOptions = {}
): Promise<PatchResult> {
  let iterations = 0;

  do {
    // Execute git-patch-checkout.sh
    executeScript("git-patch-checkout.sh", scriptsDir, config.projectRoot);

    // Run review and develop
    await runPatchIteration(workingDirPath, fs, ai);

    // Execute git-patch-complete.sh
    executeScript("git-patch-complete.sh", scriptsDir, config.projectRoot);

    iterations++;
  } while (!options.once);

  return {
    workingDirName: basename(workingDirPath),
    iterations,
  };
}
