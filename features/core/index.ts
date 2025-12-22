/**
 * Core feature - provides tools to generate code for a feature.
 *
 * Per GOAL.md:
 * - Tasks are NOT exposed outside of the feature
 * - Commands ARE exposed outside of the feature
 */

export type {
  FileContent,
  FeatureContext,
  ResearchResult,
  ReviewResult,
  FileEdit,
  DevelopResult,
  SummaryFile,
  SummaryResult,
  FileSystem,
  AIModel,
  CoreConfig,
} from "./types.js";

export { gatherFeatureContext } from "./context.js";

// Claude Code integration
export { ClaudeCodeAI, runClaudeCode } from "./claude/index.js";
export type { ClaudeCodeOptions, ClaudeCodeResult } from "./claude/types.js";

// Commands (exposed outside of the feature)
export { patch } from "./commands/patch/index.js";
export type { PatchOptions, PatchResult } from "./commands/patch/index.js";
