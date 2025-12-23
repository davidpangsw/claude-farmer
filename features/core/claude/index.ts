/**
 * Claude Code headless mode integration.
 *
 * Provides an implementation of the AIModel interface that uses
 * Claude Code in headless mode to generate responses.
 */

import type { AIModel, WorkingDirContext, FileEdit, FileSystem } from "../types.js";
import type { ClaudeCodeOptions, ClaudeCodeResult } from "./types.js";
import { spawn } from "child_process";
import { join } from "path";

export type { ClaudeCodeOptions, ClaudeCodeResult } from "./types.js";

/**
 * Runs Claude Code in headless mode with the given options.
 */
export async function runClaudeCode(
  options: ClaudeCodeOptions
): Promise<ClaudeCodeResult> {
  const args = ["--print"];

  if (options.ultrathink !== false) {
    args.push("--ultrathink");
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  args.push(options.prompt);

  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: options.timeout,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        output: stdout || stderr,
        exitCode: code ?? 1,
        success: code === 0,
      });
    });

    proc.on("error", (err) => {
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
  private tasksDir: string;
  private fs: FileSystem;

  constructor(options: {
    cwd?: string;
    ultrathink?: boolean;
    model?: string;
    timeout?: number;
    tasksDir: string;
    fs: FileSystem;
  }) {
    this.cwd = options.cwd;
    this.ultrathink = options.ultrathink ?? true;
    this.model = options.model;
    this.timeout = options.timeout;
    this.tasksDir = options.tasksDir;
    this.fs = options.fs;
  }

  private async readPromptFile(taskName: string): Promise<string> {
    const promptPath = join(this.tasksDir, taskName, "PROMPT.md");
    return this.fs.readFile(promptPath);
  }

  async generateReview(context: WorkingDirContext): Promise<string> {
    const promptTemplate = await this.readPromptFile("review");
    const contextStr = formatContext(context);

    const prompt = `${promptTemplate}\n\n---\n\n${contextStr}`;

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
    const promptTemplate = await this.readPromptFile("develop");
    const contextStr = formatContext(context);

    const prompt = `${promptTemplate}\n\n---\n\n${contextStr}\n\n---\n\nRespond with JSON array of file edits: [{"path": "...", "content": "..."}]`;

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

    // Parse JSON from output
    const jsonMatch = result.output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not parse file edits from Claude Code output");
    }

    return JSON.parse(jsonMatch[0]) as FileEdit[];
  }
}
