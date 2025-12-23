/**
 * Core feature - provides tools to generate code within a working directory.
 *
 * Per GOAL.md:
 * - Tasks are NOT exposed outside of the feature
 * - Commands ARE exposed outside of the feature
 */

export type {
  FileContent,
  WorkingDirContext,
  ReviewResult,
  FileEdit,
  DevelopResult,
  FileSystem,
  AIModel,
  CoreConfig,
} from "./types.js";

export { gatherWorkingDirContext } from "./context.js";

// Claude Code integration
export { ClaudeCodeAI, runClaudeCode } from "./claude/index.js";
export type { ClaudeCodeOptions, ClaudeCodeResult } from "./claude/types.js";

// Commands (exposed outside of the feature)
export { patch } from "./commands/patch/index.js";
export type { PatchOptions, PatchResult } from "./commands/patch/index.js";
