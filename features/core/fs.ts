/**
 * Real file system implementation using Node.js fs module.
 */

import {
  readFile,
  writeFile,
  appendFile,
  mkdir,
  unlink,
  access,
} from "fs/promises";
import { glob } from "glob";
import type { FileSystem } from "./types.js";

/**
 * Node.js file system implementation.
 */
export class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, "utf-8");
  }

  async appendFile(path: string, content: string): Promise<void> {
    await appendFile(path, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    const globPattern = pattern ? `${directory}/${pattern}` : `${directory}/**/*`;
    return glob(globPattern, { nodir: true, absolute: true });
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async deleteFile(path: string): Promise<void> {
    await unlink(path);
  }
}
