/**
 * Develop task implementation.
 *
 * Reads $f/GOAL.md, $f/docs/REVIEW.md (if it exists),
 * and the relevant source code in $f/ to edit the code.
 */

import type {
  DevelopResult,
  FileSystem,
  AIModel,
  CoreConfig,
} from "../../types.js";
import { gatherFeatureContext } from "../../context.js";
import { dirname } from "path";

/**
 * Develops a feature by generating and applying code edits.
 *
 * @param featureName - The name of the feature to develop
 * @param config - Core configuration
 * @param fs - File system interface
 * @param ai - AI model interface
 * @returns The develop result with the applied edits
 */
export async function develop(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel
): Promise<DevelopResult> {
  // Gather context (including review if it exists)
  const context = await gatherFeatureContext(featureName, config, fs);

  // Generate edits using AI
  const edits = await ai.generateEdits(context);

  // Apply edits
  for (const edit of edits) {
    // Ensure parent directory exists
    const dir = dirname(edit.path);
    await fs.mkdir(dir);

    await fs.writeFile(edit.path, edit.content);
  }

  return {
    featureName,
    edits,
  };
}
