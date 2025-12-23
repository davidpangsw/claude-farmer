/**
 * Develop task implementation.
 *
 * Reads claude-farmer/GOAL.md, claude-farmer/docs/REVIEW.md (if it exists),
 * and the relevant source code to implement requirements and address feedback.
 */

import type { DevelopResult, AIModel } from "../../types.js";
import { gatherWorkingDirContext } from "../../context.js";
import { writeFile, mkdir } from "fs/promises";
import { dirname, basename, resolve, sep } from "path";

/**
 * Validates that a file path is within the working directory.
 * Prevents path traversal attacks from AI-generated paths.
 */
function isPathWithinWorkingDir(filePath: string, workingDirPath: string): boolean {
  const resolvedPath = resolve(workingDirPath, filePath);
  const resolvedWorkingDir = resolve(workingDirPath);
  return resolvedPath === resolvedWorkingDir ||
    resolvedPath.startsWith(resolvedWorkingDir + sep);
}

/**
 * Develops a working directory by generating and applying code edits.
 */
export async function develop(
  workingDirPath: string,
  ai: AIModel
): Promise<DevelopResult> {
  // Gather context (including review if it exists)
  const context = await gatherWorkingDirContext(workingDirPath);

  // Generate edits using AI
  const edits = await ai.generateEdits(context);

  // Filter and apply edits
  const safeEdits = [];
  for (const edit of edits) {
    // Validate path is within working directory
    if (!isPathWithinWorkingDir(edit.path, workingDirPath)) {
      console.warn(`[develop] Path traversal blocked: ${edit.path} is outside working directory`);
      continue;
    }

    safeEdits.push(edit);

    // Ensure parent directory exists
    const dir = dirname(edit.path);
    await mkdir(dir, { recursive: true });

    await writeFile(edit.path, edit.content, "utf-8");
  }

  return {
    workingDirName: basename(workingDirPath),
    edits: safeEdits,
  };
}
