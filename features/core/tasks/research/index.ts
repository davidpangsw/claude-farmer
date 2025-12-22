/**
 * Research task implementation.
 *
 * Reads $f/GOAL.md and the relevant source code in $f/,
 * researches on the internet to produce $f/docs/RESEARCH.md.
 */

import type {
  ResearchResult,
  FileSystem,
  AIModel,
  CoreConfig,
} from "../../types.js";
import { gatherFeatureContext } from "../../context.js";
import { join, dirname } from "path";

/**
 * Researches a feature and generates findings from web searches.
 *
 * @param featureName - The name of the feature to research
 * @param config - Core configuration
 * @param fs - File system interface
 * @param ai - AI model interface
 * @returns The research result with the generated content
 */
export async function research(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel
): Promise<ResearchResult> {
  // Gather context
  const context = await gatherFeatureContext(featureName, config, fs);

  // Generate research using AI (which may involve web searches)
  const researchContent = await ai.generateResearch(context);

  // Write research to docs/RESEARCH.md
  const researchPath = join(context.featurePath, "docs", "RESEARCH.md");

  // Ensure docs directory exists
  const docsDir = dirname(researchPath);
  await fs.mkdir(docsDir);

  await fs.writeFile(researchPath, researchContent);

  return {
    featureName,
    researchPath,
    content: researchContent,
  };
}
