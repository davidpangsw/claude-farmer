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
import { dirname, basename } from "path";

/**
 * Develops a working directory by generating and applying code edits.
 *
 * @param workingDirPath - The path to the working directory
 * @param fs - File system interface
 * @param ai - AI model interface
 * @returns The develop result with the applied edits
 */
export async function develop(
  workingDirPath: string,
  fs: FileSystem,
  ai: AIModel
): Promise<DevelopResult> {
  // Gather context (including review if it exists)
  const context = await gatherWorkingDirContext(workingDirPath, fs);

  // Generate edits using AI
  const edits = await ai.generateEdits(context);

  // Apply edits
  for (const edit of edits) {
    // Ensure parent directory exists
    const dir = dirname(edit.path);
    await fs.mkdir(dir);

    await fs.writeFile(edit.path, edit.content);
  }

  return {
    workingDirName: basename(workingDirPath),
    edits,
  };
}
