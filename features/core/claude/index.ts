/**
 * Claude Code headless mode integration.
 *
 * Provides an implementation of the AIModel interface that uses
 * Claude Code in headless mode to generate responses.
 */

import type { AIModel, WorkingDirContext, FileEdit } from "../types.js";
import type { ClaudeCodeOptions, ClaudeCodeResult } from "./types.js";
import { REVIEW_PROMPT, DEVELOP_PROMPT } from "./prompts/index.js";
import { spawn } from "child_process";

export type { ClaudeCodeOptions, ClaudeCodeResult } from "./types.js";

/**
 * Type guard to validate FileEdit structure (lenient).
 */
function isValidFileEdit(obj: unknown): obj is FileEdit {
  if (typeof obj !== "object" || obj === null) return false;
  const edit = obj as Record<string, unknown>;
  // Accept path or file as the path field
  const path = edit.path ?? edit.file;
  // Accept content or code as the content field
  const content = edit.content ?? edit.code;
  return typeof path === "string" && typeof content === "string";
}

/**
 * Normalize a FileEdit object (handle alternative field names).
 */
function normalizeFileEdit(obj: unknown): FileEdit {
  const edit = obj as Record<string, unknown>;
  return {
    path: (edit.path ?? edit.file) as string,
    content: (edit.content ?? edit.code) as string,
  };
}

/**
 * Try to fix common JSON issues and parse.
 */
function tryParseJSON(text: string): unknown | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to repairs
  }

  // Try fixing trailing commas: ,] or ,}
  try {
    const fixed = text.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(fixed);
  } catch {
    // Continue
  }

  // Try fixing missing quotes around keys
  try {
    const fixed = text.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    return JSON.parse(fixed);
  } catch {
    // Continue
  }

  // Try fixing single quotes to double quotes
  try {
    const fixed = text.replace(/'/g, '"');
    return JSON.parse(fixed);
  } catch {
    // Continue
  }

  return null;
}

/**
 * Extract array candidates from text using bracket matching.
 */
function extractArrayCandidates(text: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let startPos = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "[") {
      if (depth === 0) {
        startPos = i;
      }
      depth++;
    } else if (char === "]") {
      depth--;
      if (depth === 0 && startPos !== -1) {
        candidates.push(text.slice(startPos, i + 1));
        startPos = -1;
      }
    }
  }

  return candidates;
}

/**
 * Parse file edits from Claude Code output with forgiving parsing.
 * Returns null if no valid edits found (not an error - AI may have nothing to edit).
 */
function parseFileEditsFromOutput(output: string): FileEdit[] | null {
  // Strategy 1: Extract JSON from markdown code blocks first
  const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/g);
  if (codeBlockMatch) {
    for (const block of codeBlockMatch.reverse()) {
      const content = block.replace(/```(?:json)?\s*/, "").replace(/```$/, "").trim();
      const candidates = extractArrayCandidates(content);
      for (const candidate of candidates.reverse()) {
        const parsed = tryParseJSON(candidate);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidFileEdit)) {
          return parsed.map(normalizeFileEdit);
        }
      }
    }
  }

  // Strategy 2: Look for arrays anywhere in the output
  const candidates = extractArrayCandidates(output);
  for (const candidate of candidates.reverse()) {
    const parsed = tryParseJSON(candidate);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidFileEdit)) {
      return parsed.map(normalizeFileEdit);
    }
  }

  // Strategy 3: Check for empty array (explicit "no changes")
  if (output.includes("[]")) {
    return [];
  }

  // Strategy 4: Look for phrases indicating no changes needed
  const noChangePhrases = [
    "no changes",
    "no edits",
    "nothing to change",
    "no modifications",
    "already complete",
    "no updates needed",
  ];
  const lowerOutput = output.toLowerCase();
  for (const phrase of noChangePhrases) {
    if (lowerOutput.includes(phrase)) {
      return [];
    }
  }

  // No valid edits found
  return null;
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

    // Debug: log raw output for troubleshooting
    console.log("[generateEdits] Raw output length:", result.output.length);
    console.log("[generateEdits] Raw output (first 2000 chars):", result.output.slice(0, 2000));

    // Parse JSON from output using forgiving parsing
    const edits = parseFileEditsFromOutput(result.output);
    console.log("[generateEdits] Parsed edits:", edits === null ? "null" : `${edits.length} edits`);
    if (edits === null) {
      // No edits found - return empty array (not an error)
      console.log("[generateEdits] No valid edits parsed from output");
      return [];
    }
    return edits;
  }
}
