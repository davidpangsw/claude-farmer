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
import { join } from "path";
import { review } from "../../tasks/review/index.js";
import { develop } from "../../tasks/develop/index.js";
import type { FileSystem, AIModel, CoreConfig } from "../../types.js";

export interface PatchOptions {
  once?: boolean;
}

export interface PatchResult {
  featureName: string;
  iterations: number;
}

/**
 * Executes a shell script in the feature's scripts directory.
 */
function executeScript(
  scriptName: string,
  featurePath: string,
  projectRoot: string
): void {
  const scriptPath = join(featurePath, "scripts", scriptName);
  execSync(`bash "${scriptPath}"`, {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

/**
 * Runs one iteration of the patch workflow.
 */
async function runPatchIteration(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel
): Promise<void> {
  // Perform Review
  await review(featureName, config, fs, ai);

  // Perform Develop
  await develop(featureName, config, fs, ai);
}

/**
 * Executes the patch command for a feature.
 */
export async function patch(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel,
  options: PatchOptions = {}
): Promise<PatchResult> {
  const featurePath = join(config.featuresDir, featureName);
  let iterations = 0;

  do {
    // Execute git-patch-checkout.sh
    executeScript("git-patch-checkout.sh", featurePath, config.projectRoot);

    // Run review and develop
    await runPatchIteration(featureName, config, fs, ai);

    // Execute git-patch-complete.sh
    executeScript("git-patch-complete.sh", featurePath, config.projectRoot);

    iterations++;
  } while (!options.once);

  return {
    featureName,
    iterations,
  };
}
