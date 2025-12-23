/**
 * Core feature - provides tools to generate code within a working directory.
 *
 * Per GOAL.md:
 * - Tasks are NOT exposed outside of the feature
 * - Commands ARE exposed outside of the feature
 */

export type { AIModel } from "./types.js";

// Claude Code integration
export { ClaudeCodeAI } from "./claude/index.js";

// Commands (exposed outside of the feature)
export { patch } from "./commands/patch/index.js";
export type { PatchOptions, PatchResult } from "./commands/patch/index.js";
