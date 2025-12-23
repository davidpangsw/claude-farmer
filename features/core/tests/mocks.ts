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
        } else if (pattern === "**/*.ts") {
          if (path.endsWith(".ts")) {
            results.push(path);
          }
        } else if (pattern === "*.log") {
          if (path.endsWith(".log")) {
            results.push(path);
          }
        } else {
          // Generic extension matching for patterns like "*.ext"
          const extMatch = pattern.match(/^\*\.(\w+)$/);
          if (extMatch && path.endsWith(`.${extMatch[1]}`)) {
            results.push(path);
          } else {
            results.push(path);
          }
        }
      }
    }
    return results;
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
