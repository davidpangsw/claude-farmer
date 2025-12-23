/**
 * Context gathering utilities for working directories.
 */

import type {
  WorkingDirContext,
  FileContent,
  FileSystem,
} from "./types.js";
import { join, basename, sep } from "path";

/**
 * Default file patterns to gather as source files.
 * Includes common source file extensions.
 */
const DEFAULT_SOURCE_PATTERNS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.json",
  "**/*.md",
];

/**
 * Gathers the context needed for reviewing or developing a working directory.
 *
 * @param workingDirPath - The path to the working directory
 * @param fs - File system interface
 * @param patterns - Optional array of glob patterns for source files (default: common extensions)
 */
export async function gatherWorkingDirContext(
  workingDirPath: string,
  fs: FileSystem,
  patterns: string[] = DEFAULT_SOURCE_PATTERNS
): Promise<WorkingDirContext> {
  const workingDirName = basename(workingDirPath);

  // Read GOAL.md from claude-farmer directory
  const goalPath = join(workingDirPath, "claude-farmer", "GOAL.md");
  const goalContent = await fs.readFile(goalPath);
  const goal: FileContent = { path: goalPath, content: goalContent };

  // Try to read REVIEW.md if it exists
  let review: FileContent | undefined;
  const reviewPath = join(workingDirPath, "claude-farmer", "docs", "REVIEW.md");
  if (await fs.exists(reviewPath)) {
    const reviewContent = await fs.readFile(reviewPath);
    review = { path: reviewPath, content: reviewContent };
  }

  // Gather source files using provided patterns, excluding claude-farmer/
  const sourceFiles: FileContent[] = [];
  const claudeFarmerPath = join(workingDirPath, "claude-farmer");
  const seenPaths = new Set<string>();

  for (const pattern of patterns) {
    const files = await fs.listFiles(workingDirPath, pattern);
    for (const filePath of files) {
      // Skip files in or under the claude-farmer directory
      if (filePath.startsWith(claudeFarmerPath + sep) || filePath === claudeFarmerPath) {
        continue;
      }
      // Skip if already processed (patterns may overlap)
      if (seenPaths.has(filePath)) {
        continue;
      }
      seenPaths.add(filePath);

      const content = await fs.readFile(filePath);
      sourceFiles.push({ path: filePath, content });
    }
  }

  return {
    workingDirName,
    workingDirPath,
    goal,
    review,
    sourceFiles,
  };
}
