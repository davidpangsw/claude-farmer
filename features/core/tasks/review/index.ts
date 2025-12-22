/**
 * Review task implementation.
 *
 * Reads $f/GOAL.md, $f/docs/RESEARCH.md, and the relevant source code in $f/
 * to produce $f/docs/REVIEW.md with suggestions to improve the feature.
 */

import type {
  ReviewResult,
  FileSystem,
  AIModel,
  CoreConfig,
} from "../../types.js";
import { gatherFeatureContext } from "../../context.js";
import { join, dirname } from "path";

/**
 * Reviews a feature and generates improvement suggestions.
 *
 * @param featureName - The name of the feature to review
 * @param config - Core configuration
 * @param fs - File system interface
 * @param ai - AI model interface
 * @returns The review result with the generated content
 */
export async function review(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem,
  ai: AIModel
): Promise<ReviewResult> {
  // Gather context
  const context = await gatherFeatureContext(featureName, config, fs);

  // Generate review using AI
  const reviewContent = await ai.generateReview(context);

  // Write review to docs/REVIEW.md
  const reviewPath = join(context.featurePath, "docs", "REVIEW.md");

  // Ensure docs directory exists
  const docsDir = dirname(reviewPath);
  await fs.mkdir(docsDir);

  await fs.writeFile(reviewPath, reviewContent);

  return {
    featureName,
    reviewPath,
    content: reviewContent,
  };
}
