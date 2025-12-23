/**
 * Claude Code headless mode integration.
 *
 * Provides an implementation of the AIModel interface that uses
 * Claude Code in headless mode to generate responses.
 */

import type { AIModel, WorkingDirContext, FileEdit } from "../types.js";
import type { ClaudeCodeOptions, ClaudeCodeResult } from "./types.js";
import { spawn } from "child_process";

export type { ClaudeCodeOptions, ClaudeCodeResult } from "./types.js";

// Embedded prompts (no need for external files)
const REVIEW_PROMPT = `# Review Prompt

Review a working directory and provide improvement suggestions. Research best practices via web search before generating suggestions.

## Context Provided

- **GOAL.md**: Project goals
- **Source Files**: Current implementation

## Your Task

1. Research best practices via web search relevant to the goals
2. Analyze implementation against goals:
   - **Goal Alignment**: Does it meet stated goals?
   - **Code Quality**: Issues to address?
   - **Missing Features**: What's incomplete?
   - **Testing**: Adequate coverage?

## Output Guidelines

- Be concise - actionable items only
- Prioritize by impact
- Skip empty sections
- No generic advice - be specific

## Output Format

\`\`\`markdown
# Review

## Summary
One-line assessment.

## Goal Alignment
- [x] Goal 1
- [ ] Goal 2: missing X

## Suggestions

### High Priority
1. ...

### Medium Priority
1. ...

## Next Steps
1. ...
\`\`\``;

const DEVELOP_PROMPT = `# Develop Prompt

Develop a feature by writing or editing code.

## Context Provided

- **GOAL.md**: Feature goals
- **REVIEW.md**: Review suggestions (if available)
- **Source Files**: Current implementation (if any)

## Your Task

1. Implement what GOAL.md specifies
2. Fix issues from REVIEW.md (if present)
3. Write tests for new functionality
4. Match existing code patterns

## Guidelines

- Minimal, focused changes
- Clean, readable code
- Error handling where needed
- JSDoc for public APIs only

## Output

Return JSON array of file edits:
\`\`\`json
[{"path": "...", "content": "..."}]
\`\`\``;

/**
 * Type guard to validate FileEdit structure.
 */
function isValidFileEdit(obj: unknown): obj is FileEdit {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as FileEdit).path === "string" &&
    typeof (obj as FileEdit).content === "string"
  );
}

/**
 * Runs Claude Code in headless mode with the given options.
 *
 * Note: Extended thinking is enabled by including "ultrathink" keyword
 * in the prompt, not via CLI flag.
 */
export async function runClaudeCode(
  options: ClaudeCodeOptions
): Promise<ClaudeCodeResult> {
  const args = ["-p"]; // -p for headless/print mode

  if (options.model) {
    args.push("--model", options.model);
  }

  // Enable extended thinking by prepending "ultrathink:" to the prompt
  const prompt = options.ultrathink !== false
    ? `ultrathink: ${options.prompt}`
    : options.prompt;

  args.push(prompt);

  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Close stdin immediately - we pass prompt via args, not stdin
    proc.stdin.end();

    let stdout = "";
    let stderr = "";
    let killed = false;

    // Implement timeout manually since spawn doesn't support it
    let timeoutId: NodeJS.Timeout | undefined;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
      }, options.timeout);
    }

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (killed) {
        resolve({
          output: `Process timed out after ${options.timeout}ms`,
          exitCode: 1,
          success: false,
        });
      } else {
        resolve({
          output: stdout || stderr,
          exitCode: code ?? 1,
          success: code === 0,
        });
      }
    });

    proc.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Formats the working directory context into a string for the prompt.
 */
function formatContext(context: WorkingDirContext): string {
  let result = "";

  result += `# GOAL.md (${context.workingDirName})\n\n${context.goal.content}\n\n`;

  if (context.review) {
    result += `# REVIEW.md\n\n${context.review.content}\n\n`;
  }

  if (context.sourceFiles.length > 0) {
    result += "# Source Files\n\n";
    for (const file of context.sourceFiles) {
      result += `## ${file.path}\n\n\`\`\`typescript\n${file.content}\n\`\`\`\n\n`;
    }
  }

  return result;
}

/**
 * Claude Code implementation of the AIModel interface.
 */
export class ClaudeCodeAI implements AIModel {
  private cwd?: string;
  private ultrathink: boolean;
  private model?: string;
  private timeout?: number;

  constructor(options: {
    cwd?: string;
    ultrathink?: boolean;
    model?: string;
    timeout?: number;
  }) {
    this.cwd = options.cwd;
    this.ultrathink = options.ultrathink ?? false;
    this.model = options.model;
    this.timeout = options.timeout;
  }

  async generateReview(context: WorkingDirContext): Promise<string> {
    const contextStr = formatContext(context);
    const prompt = `${REVIEW_PROMPT}\n\n---\n\n${contextStr}`;

    const result = await runClaudeCode({
      prompt,
      cwd: this.cwd,
      ultrathink: this.ultrathink,
      model: this.model,
      timeout: this.timeout,
    });

    if (!result.success) {
      throw new Error(`Claude Code failed: ${result.output}`);
    }

    return result.output;
  }

  async generateEdits(context: WorkingDirContext): Promise<FileEdit[]> {
    const contextStr = formatContext(context);
    const prompt = `${DEVELOP_PROMPT}\n\n---\n\n${contextStr}\n\n---\n\nRespond with JSON array of file edits: [{"path": "...", "content": "..."}]`;

    const result = await runClaudeCode({
      prompt,
      cwd: this.cwd,
      ultrathink: this.ultrathink,
      model: this.model,
      timeout: this.timeout,
    });

    if (!result.success) {
      throw new Error(`Claude Code failed: ${result.output}`);
    }

    // Parse JSON from output by finding '[' positions and using bracket matching
    // Find all top-level array candidates by tracking bracket depth
    const candidates: string[] = [];
    let depth = 0;
    let startPos = -1;

    for (let i = 0; i < result.output.length; i++) {
      const char = result.output[i];
      if (char === "[") {
        if (depth === 0) {
          startPos = i;
        }
        depth++;
      } else if (char === "]") {
        depth--;
        if (depth === 0 && startPos !== -1) {
          candidates.push(result.output.slice(startPos, i + 1));
          startPos = -1;
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error("Could not parse file edits from Claude Code output");
    }

    // Try parsing from the last candidate first since output is usually at the end
    for (let i = candidates.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(candidates[i]);
        if (Array.isArray(parsed) && parsed.every(isValidFileEdit)) {
          return parsed;
        }
      } catch {
        // Not valid JSON, try next candidate
      }
    }

    throw new Error("Could not find valid file edits JSON in Claude Code output");
  }
}
