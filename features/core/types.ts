/**
 * Core types for the claude-farmer feature system.
 */

/**
 * Represents a file with its path and content.
 */
export interface FileContent {
  path: string;
  content: string;
}

/**
 * Context gathered for reviewing or developing a feature.
 */
export interface FeatureContext {
  featureName: string;
  featurePath: string;
  goal: FileContent;
  research?: FileContent;
  review?: FileContent;
  sourceFiles: FileContent[];
}

/**
 * Result of a research operation.
 */
export interface ResearchResult {
  featureName: string;
  researchPath: string;
  content: string;
}

/**
 * Result of a review operation.
 */
export interface ReviewResult {
  featureName: string;
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
  featureName: string;
  edits: FileEdit[];
}

/**
 * A summary file to be written.
 */
export interface SummaryFile {
  /** Filename (not full path) */
  filename: string;
  /** File content */
  content: string;
}

/**
 * Result of a summary operation.
 */
export interface SummaryResult {
  featureName: string;
  summaryDir: string;
  files: SummaryFile[];
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
   * Generate research based on the provided context.
   * This may involve web searches and gathering external information.
   */
  generateResearch(context: FeatureContext): Promise<string>;

  /**
   * Generate a review based on the provided context.
   */
  generateReview(context: FeatureContext): Promise<string>;

  /**
   * Generate code edits based on the provided context.
   */
  generateEdits(context: FeatureContext): Promise<FileEdit[]>;

  /**
   * Generate summary files based on the provided context.
   */
  generateSummary(context: FeatureContext): Promise<SummaryFile[]>;
}

/**
 * Configuration for the core feature.
 */
export interface CoreConfig {
  projectRoot: string;
  featuresDir: string;
}
