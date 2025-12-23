/**
 * Review task implementation.
 *
 * Reads claude-farmer/GOAL.md and the relevant source code
 * to produce claude-farmer/docs/REVIEW.md with improvement suggestions.
 * Includes research via web search.
 */

import type { ReviewResult, AIModel } from "../../types.js";
import { gatherWorkingDirContext } from "../../context.js";
import { writeFile, mkdir } from "fs/promises";
import { join, basename, dirname } from "path";

/**
 * Reviews a working directory and generates improvement suggestions.
 */
export async function review(
  workingDirPath: string,
  ai: AIModel
): Promise<ReviewResult> {
  // Gather context
  const context = await gatherWorkingDirContext(workingDirPath);

  // Generate review using AI (includes research via web search)
  const reviewContent = await ai.generateReview(context);

  // Write review to claude-farmer/docs/REVIEW.md
  const reviewPath = join(workingDirPath, "claude-farmer", "docs", "REVIEW.md");

  // Ensure docs directory exists
  const docsDir = dirname(reviewPath);
  await mkdir(docsDir, { recursive: true });

  await writeFile(reviewPath, reviewContent, "utf-8");

  return {
    workingDirName: basename(workingDirPath),
    reviewPath,
    content: reviewContent,
  };
}
