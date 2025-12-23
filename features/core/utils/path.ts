/**
 * Path utilities for claude-farmer.
 */

import { resolve, sep } from "path";

/**
 * Validates that a file path is within the working directory.
 * Prevents path traversal attacks from AI-generated paths.
 */
export function isPathWithinWorkingDir(filePath: string, workingDirPath: string): boolean {
  const resolvedPath = resolve(workingDirPath, filePath);
  const resolvedWorkingDir = resolve(workingDirPath);
  return resolvedPath === resolvedWorkingDir ||
    resolvedPath.startsWith(resolvedWorkingDir + sep);
}
