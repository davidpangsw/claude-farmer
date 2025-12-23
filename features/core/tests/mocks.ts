/**
 * Mock implementations for testing.
 */

import type { FileSystem, AIModel, WorkingDirContext, FileEdit } from "../types.js";

/**
 * In-memory file system mock for testing.
 */
export class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor(initialFiles?: Record<string, string>) {
    if (initialFiles) {
      for (const [path, content] of Object.entries(initialFiles)) {
        this.files.set(path, content);
      }
    }
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async appendFile(path: string, content: string): Promise<void> {
    const existing = this.files.get(path) ?? "";
    this.files.set(path, existing + content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    // Normalize directory to ensure consistent matching (with trailing separator)
    const normalizedDir = directory.endsWith("/") ? directory : `${directory}/`;
    const results: string[] = [];
    for (const path of this.files.keys()) {
      // Check if file is within directory (handle both with and without trailing slash)
      if (path.startsWith(normalizedDir) || path.startsWith(directory + "/")) {
        if (!pattern) {
          results.push(path);
        } else {
          // Handle glob patterns
          const matched = this.matchPattern(path, pattern);
          if (matched) {
            results.push(path);
          }
        }
      }
    }
    return results;
  }

  /**
   * Simple glob pattern matching for common patterns.
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Handle **/*.ext patterns
    const globMatch = pattern.match(/^\*\*\/\*\.([\w]+)$/);
    if (globMatch) {
      return filePath.endsWith(`.${globMatch[1]}`);
    }

    // Handle *.ext patterns
    const extMatch = pattern.match(/^\*\.([\w]+)$/);
    if (extMatch) {
      return filePath.endsWith(`.${extMatch[1]}`);
    }

    // Handle **/filename patterns
    const nameMatch = pattern.match(/^\*\*\/(.+)$/);
    if (nameMatch) {
      return filePath.endsWith(`/${nameMatch[1]}`) || filePath === nameMatch[1];
    }

    // Default: include if no specific pattern handling
    return true;
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(path);
  }

  // Test helper methods
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }
}

/**
 * Mock AI model for testing.
 */
export class MockAIModel implements AIModel {
  private reviewResponse: string;
  private editsResponse: FileEdit[];

  constructor(
    reviewResponse: string = "# Review\n\nNo suggestions.",
    editsResponse: FileEdit[] = []
  ) {
    this.reviewResponse = reviewResponse;
    this.editsResponse = editsResponse;
  }

  async generateReview(context: WorkingDirContext): Promise<string> {
    return this.reviewResponse;
  }

  async generateEdits(context: WorkingDirContext): Promise<FileEdit[]> {
    return this.editsResponse;
  }

  // Test helper methods
  setReviewResponse(response: string): void {
    this.reviewResponse = response;
  }

  setEditsResponse(edits: FileEdit[]): void {
    this.editsResponse = edits;
  }
}
