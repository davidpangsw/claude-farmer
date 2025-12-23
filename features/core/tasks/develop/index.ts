/**
 * Develop task implementation.
 *
 * Reads claude-farmer/GOAL.md, claude-farmer/docs/REVIEW.md (if it exists),
 * and the relevant source code to implement requirements and address feedback.
 */

import type { DevelopResult, AIModel } from "../../types.js";
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
  const safeEdits = [];
  let hasDevelopMd = false;

  for (const edit of edits) {
    // Validate path is within working directory
    if (!isPathWithinWorkingDir(edit.path, workingDirPath)) {
      console.warn(`[develop] Path traversal blocked: ${edit.path} is outside working directory`);
      continue;
    }

    // Resolve to absolute path
    const absolutePath = resolve(workingDirPath, edit.path);
    safeEdits.push({ ...edit, path: absolutePath });

    // Track if DEVELOP.md is included
    if (edit.path.endsWith("DEVELOP.md")) {
      hasDevelopMd = true;
    }

    // Ensure parent directory exists
    const dir = dirname(absolutePath);
    await mkdir(dir, { recursive: true });

    await writeFile(absolutePath, edit.content, "utf-8");
  }

  // Generate fallback DEVELOP.md if AI didn't include one
  if (!hasDevelopMd && safeEdits.length > 0) {
    const developMdPath = join(workingDirPath, "claude-farmer", "docs", "DEVELOP.md");
    const fileList = safeEdits.map(e => `- ${basename(e.path)}`).join("\n");
    const content = `# Development Log

## Changes Made
${fileList}

## Problems Encountered
None reported.
`;

    await mkdir(dirname(developMdPath), { recursive: true });
    await writeFile(developMdPath, content, "utf-8");
    safeEdits.push({ path: developMdPath, content });
  }

  return {
    workingDirName: basename(workingDirPath),
    edits: safeEdits,
  };
}
