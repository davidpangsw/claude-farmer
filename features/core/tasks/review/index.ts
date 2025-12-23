/**
 * Review task implementation.
 *
 * Reads claude-farmer/GOAL.md and the relevant source code
 * to produce claude-farmer/docs/REVIEW.md with improvement suggestions.
 * Includes research via web search.
 */

import type {
  ReviewResult,
  FileSystem,
  AIModel,
} from "../../types.js";
import { gatherWorkingDirContext } from "../../context.js";
import { join, basename, dirname } from "path";

/**
 * Reviews a working directory and generates improvement suggestions.
 *
 * @param workingDirPath - The path to the working directory
 * @param fs - File system interface
 * @param ai - AI model interface
 * @returns The review result with the generated content
 */
export async function review(
  workingDirPath: string,
  fs: FileSystem,
  ai: AIModel
): Promise<ReviewResult> {
  // Gather context
  const context = await gatherWorkingDirContext(workingDirPath, fs);

  // Generate review using AI (includes research via web search)
  const reviewContent = await ai.generateReview(context);

  // Write review to claude-farmer/docs/REVIEW.md
  const reviewPath = join(workingDirPath, "claude-farmer", "docs", "REVIEW.md");

  // Ensure docs directory exists
  const docsDir = dirname(reviewPath);
  await fs.mkdir(docsDir);

  await fs.writeFile(reviewPath, reviewContent);

  return {
    workingDirName: basename(workingDirPath),
    reviewPath,
    content: reviewContent,
  };
}
