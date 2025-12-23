/**
 * Context gathering utilities for working directories.
 */

import type { WorkingDirContext, FileContent } from "./types.js";
import { readFile, access, stat } from "fs/promises";
import { glob } from "glob";
import { join, basename, sep } from "path";

/**
 * Default file patterns to gather as source files.
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
 * Patterns to ignore when gathering source files.
 */
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/package-lock.json",
  "**/*.lock",
];

/**
 * Maximum file size in bytes (100KB).
 */
const MAX_FILE_SIZE = 100 * 1024;

/**
 * Gathers the context needed for reviewing or developing a working directory.
 */
export async function gatherWorkingDirContext(
  workingDirPath: string,
  patterns: string[] = DEFAULT_SOURCE_PATTERNS
): Promise<WorkingDirContext> {
  const workingDirName = basename(workingDirPath);

  // Read GOAL.md from claude-farmer directory
  const goalPath = join(workingDirPath, "claude-farmer", "GOAL.md");
  const goalContent = await readFile(goalPath, "utf-8");
  const goal: FileContent = { path: goalPath, content: goalContent };

  // Try to read REVIEW.md if it exists
  let review: FileContent | undefined;
  const reviewPath = join(workingDirPath, "claude-farmer", "docs", "REVIEW.md");
  try {
    await access(reviewPath);
    const reviewContent = await readFile(reviewPath, "utf-8");
    review = { path: reviewPath, content: reviewContent };
  } catch {
    // REVIEW.md doesn't exist yet
  }

  // Gather source files using provided patterns, excluding claude-farmer/
  const sourceFiles: FileContent[] = [];
  const claudeFarmerPath = join(workingDirPath, "claude-farmer");
  const seenPaths = new Set<string>();

  for (const pattern of patterns) {
    const files = await glob(`${workingDirPath}/${pattern}`, {
      nodir: true,
      absolute: true,
      ignore: IGNORE_PATTERNS.map(p => `${workingDirPath}/${p}`),
    });
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

      // Check file size before reading
      const fileStat = await stat(filePath);
      if (fileStat.size > MAX_FILE_SIZE) {
        continue;
      }

      const content = await readFile(filePath, "utf-8");
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
