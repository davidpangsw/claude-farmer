/**
 * Context gathering utilities for features.
 */

import type {
  FeatureContext,
  FileContent,
  FileSystem,
  CoreConfig,
} from "./types.js";
import { join } from "path";

/**
 * Gathers the context needed for reviewing or developing a feature.
 */
export async function gatherFeatureContext(
  featureName: string,
  config: CoreConfig,
  fs: FileSystem
): Promise<FeatureContext> {
  const featurePath = join(config.featuresDir, featureName);

  // Read GOAL.md from feature directory
  const goalPath = join(featurePath, "GOAL.md");
  const goalContent = await fs.readFile(goalPath);
  const goal: FileContent = { path: goalPath, content: goalContent };

  // Try to read RESEARCH.md if it exists
  let research: FileContent | undefined;
  const researchPath = join(featurePath, "docs", "RESEARCH.md");
  if (await fs.exists(researchPath)) {
    const researchContent = await fs.readFile(researchPath);
    research = { path: researchPath, content: researchContent };
  }

  // Try to read REVIEW.md if it exists
  let review: FileContent | undefined;
  const reviewPath = join(featurePath, "docs", "REVIEW.md");
  if (await fs.exists(reviewPath)) {
    const reviewContent = await fs.readFile(reviewPath);
    review = { path: reviewPath, content: reviewContent };
  }

  // Gather source files (*.ts files in feature directory)
  const sourceFiles: FileContent[] = [];
  const tsFiles = await fs.listFiles(featurePath, "**/*.ts");
  for (const filePath of tsFiles) {
    const content = await fs.readFile(filePath);
    sourceFiles.push({ path: filePath, content });
  }

  return {
    featureName,
    featurePath,
    goal,
    research,
    review,
    sourceFiles,
  };
}
