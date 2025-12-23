/**
 * Develop task implementation.
 *
 * Reads claude-farmer/GOAL.md, claude-farmer/docs/REVIEW.md (if it exists),
 * and the relevant source code to implement requirements and address feedback.
 */

import type {
  DevelopResult,
  FileSystem,
  AIModel,
} from "../../types.js";
import { gatherWorkingDirContext } from "../../context.js";
import { dirname, basename, resolve, sep } from "path";

/**
 * Validates that a file path is within the working directory.
 * Prevents path traversal attacks from AI-generated paths.
 *
 * @param filePath - The file path to validate
 * @param workingDirPath - The working directory path
 * @returns true if the path is safe, false otherwise
 */
function isPathWithinWorkingDir(filePath: string, workingDirPath: string): boolean {
  // Resolve both paths to absolute, normalized form
  const resolvedPath = resolve(workingDirPath, filePath);
  const resolvedWorkingDir = resolve(workingDirPath);

  // Check if the resolved path starts with the working directory
  // Add trailing separator to prevent matching partial directory names
  // e.g., /project-evil should not match /project
  // Use path.sep for cross-platform compatibility (Windows uses \, Unix uses /)
  return resolvedPath === resolvedWorkingDir ||
    resolvedPath.startsWith(resolvedWorkingDir + sep);
}

/**
 * Develops a working directory by generating and applying code edits.
 *
 * @param workingDirPath - The path to the working directory
 * @param fs - File system interface
 * @param ai - AI model interface
 * @param options - Optional settings
 * @returns The develop result with the applied edits
 */
export async function develop(
  workingDirPath: string,
  fs: FileSystem,
  ai: AIModel,
  options: { dryRun?: boolean } = {}
): Promise<DevelopResult> {
  // Gather context (including review if it exists)
  const context = await gatherWorkingDirContext(workingDirPath, fs);

  // Generate edits using AI
  const edits = await ai.generateEdits(context);

  // Filter and apply edits
  const safeEdits = [];
  for (const edit of edits) {
    // Validate path is within working directory
    if (!isPathWithinWorkingDir(edit.path, workingDirPath)) {
      // Skip edits that would write outside working directory
      // This is a security measure against path traversal
      continue;
    }

    safeEdits.push(edit);

    if (!options.dryRun) {
      // Ensure parent directory exists
      const dir = dirname(edit.path);
      await fs.mkdir(dir);

      await fs.writeFile(edit.path, edit.content);
    }
  }

  return {
    workingDirName: basename(workingDirPath),
    edits: safeEdits,
  };
}
