/**
 * Summary task implementation.
 *
 * Reads $f/GOAL.md, $f/docs/RESEARCH.md, and the relevant source code in $f/
 * to produce files in $f/SUMMARY/.
 */

import type {
  SummaryResult,
  FileSystem,
  AIModel,
  CoreConfig,
} from "../../types.js";
import { gatherFeatureContext } from "../../context.js";
import { join } from "path";

/**
 * Generates summary files for a feature.
 *
 * @param featureName - The name of the feature to summarize
 * @param config - Core configuration
 * @param fs - File system interface
 * @param ai - AI model interface
 * @returns The summary result with the generated files
 */
export async function summary(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel
): Promise<SummaryResult> {
  // Gather context
  const context = await gatherFeatureContext(featureName, config, fs);

  // Generate summary files using AI
  const summaryFiles = await ai.generateSummary(context);

  // Write files to SUMMARY/ directory
  const summaryDir = join(context.featurePath, "SUMMARY");
  await fs.mkdir(summaryDir);

  for (const file of summaryFiles) {
    const filePath = join(summaryDir, file.filename);
    await fs.writeFile(filePath, file.content);
  }

  return {
    featureName,
    summaryDir,
    files: summaryFiles,
  };
}
