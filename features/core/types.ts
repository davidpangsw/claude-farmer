/**
 * Core types for the claude-farmer system.
 */

/**
 * Represents a file with its path and content.
 */
export interface FileContent {
  path: string;
  content: string;
}

/**
 * Context gathered for reviewing or developing a working directory.
 */
export interface WorkingDirContext {
  workingDirName: string;
  workingDirPath: string;
  goal: FileContent;
  review?: FileContent;
  sourceFiles: FileContent[];
}

/**
 * Result of a review operation.
 */
export interface ReviewResult {
  workingDirName: string;
  reviewPath: string;
  content: string;
}

/**
 * A file edit operation.
 */
export interface FileEdit {
  path: string;
  content: string;
}

/**
 * Result of a develop operation.
 */
export interface DevelopResult {
  workingDirName: string;
  edits: FileEdit[];
}

/**
 * Interface for file system operations.
 * This allows the core feature to be testable with mock implementations.
 */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(directory: string, pattern?: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
}

/**
 * Interface for AI model operations.
 * This abstracts the AI backend to allow different implementations.
 */
export interface AIModel {
  /**
   * Generate a review based on the provided context.
   * Includes research via web search, then generates improvement suggestions.
   */
  generateReview(context: WorkingDirContext): Promise<string>;

  /**
   * Generate code edits based on the provided context.
   * Implements GOAL requirements and addresses REVIEW feedback.
   */
  generateEdits(context: WorkingDirContext): Promise<FileEdit[]>;
}

