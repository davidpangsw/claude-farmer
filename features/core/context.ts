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
 * Gathers the context needed for reviewing or developing a working directory.
 */
export async function gatherWorkingDirContext(
  workingDirPath: string,
  fs: FileSystem
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

  // Gather source files (*.ts files in working directory, excluding claude-farmer/)
  const sourceFiles: FileContent[] = [];
  const tsFiles = await fs.listFiles(workingDirPath, "**/*.ts");
  for (const filePath of tsFiles) {
    // Skip files in claude-farmer directory (use sep for cross-platform)
    if (!filePath.includes(`${sep}claude-farmer${sep}`)) {
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
