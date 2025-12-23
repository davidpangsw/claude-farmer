/**
 * Types for Claude Code headless mode integration.
 */

/**
 * Options for running Claude Code in headless mode.
 */
export interface ClaudeCodeOptions {
  /** The prompt to send to Claude Code */
  prompt: string;
  /** Working directory for the command */
  cwd?: string;
  /** Whether to use ultrathink mode (default: false) */
  ultrathink?: boolean;
  /** Model to use (default: uses Claude Code's default) */
  model?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result from running Claude Code.
 */
export interface ClaudeCodeResult {
  /** The output from Claude Code */
  output: string;
  /** Exit code */
  exitCode: number;
  /** Whether the command succeeded */
  success: boolean;
}
