/**
 * Develop task implementation.
 *
 * Reads claude-farmer/GOAL.md, claude-farmer/docs/REVIEW.md (if it exists),
 * and the relevant source code to implement requirements and address feedback.
 */

import type { DevelopResult, AIModel, FileEdit } from "../../types.js";
import { gatherWorkingDirContext } from "../../context.js";
import { isPathWithinWorkingDir } from "../../utils/index.js";
import { writeFile, mkdir } from "fs/promises";
import { dirname, basename, resolve, join } from "path";

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
  const safeEdits: FileEdit[] = [];
  let hasDevelopJson = false;

  for (const edit of edits) {
    // Validate path is within working directory
    if (!isPathWithinWorkingDir(edit.path, workingDirPath)) {
      console.warn(`[develop] Path traversal blocked: ${edit.path} is outside working directory`);
      continue;
    }

    // Resolve to absolute path
    const absolutePath = resolve(workingDirPath, edit.path);
    safeEdits.push({ ...edit, path: absolutePath });

    // Track if DEVELOP.json is included
    if (edit.path.endsWith("DEVELOP.json")) {
      hasDevelopJson = true;
    }

    // Ensure parent directory exists
    const dir = dirname(absolutePath);
    await mkdir(dir, { recursive: true });

    await writeFile(absolutePath, edit.content, "utf-8");
  }

  // Generate fallback DEVELOP.json if AI didn't include one
  if (!hasDevelopJson && safeEdits.length > 0) {
    const developJsonPath = join(workingDirPath, "claude-farmer", "docs", "DEVELOP.json");
    const editsSummary = safeEdits.map(e => ({
      path: e.path,
      size: e.content.length,
    }));
    const content = JSON.stringify({
      changes: editsSummary,
      problems: [],
    }, null, 2);

    await mkdir(dirname(developJsonPath), { recursive: true });
    await writeFile(developJsonPath, content, "utf-8");
    safeEdits.push({ path: developJsonPath, content });
  }

  return {
    workingDirName: basename(workingDirPath),
    edits: safeEdits,
  };
}
