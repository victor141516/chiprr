import ignore, { type Ignore } from "ignore";
import * as fs from "fs/promises";
import * as path from "path";
import { Logger } from "../logging/Logger";

const IGNORE_FILENAME = ".chiprrignore";

export class IgnoreFilter {
  private logger: Logger;
  private ignoreCache: Map<string, Ignore | "ignore-all" | null>;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
    this.ignoreCache = new Map();
  }

  async shouldIgnore(filePath: string, basePath: string): Promise<boolean> {
    const relativePath = path.relative(basePath, filePath);
    const directories = this.getDirectoryHierarchy(filePath, basePath);

    for (const dir of directories) {
      const ignoreRules = await this.getIgnoreRules(dir);
      if (ignoreRules === null) continue;

      if (ignoreRules === "ignore-all") {
        this.logger.debug(
          `Ignoring ${relativePath} due to empty .chiprrignore in ${dir}`,
        );
        return true;
      }

      if (ignoreRules.ignores(relativePath)) {
        this.logger.debug(
          `Ignoring ${relativePath} due to .chiprrignore pattern in ${dir}`,
        );
        return true;
      }
    }

    return false;
  }

  private async getIgnoreRules(
    directory: string,
  ): Promise<Ignore | "ignore-all" | null> {
    if (this.ignoreCache.has(directory)) {
      return this.ignoreCache.get(directory) ?? null;
    }

    const ignoreFilePath = path.join(directory, IGNORE_FILENAME);

    try {
      const content = await fs.readFile(ignoreFilePath, "utf-8");

      if (content.trim() === "") {
        // Empty file means ignore everything
        this.logger.debug(
          `Found empty .chiprrignore in ${directory} - ignoring all files`,
        );
        this.ignoreCache.set(directory, "ignore-all");
        return "ignore-all";
      }

      const ig = ignore().add(content);
      this.logger.debug(
        `Loaded .chiprrignore patterns from ${directory}: ${
          content
            .split("\n")
            .filter((line) => line.trim() && !line.startsWith("#")).length
        } rules`,
      );
      this.ignoreCache.set(directory, ig);
      return ig;
    } catch (error) {
      // No .chiprrignore file in this directory
      this.ignoreCache.set(directory, null);
      return null;
    }
  }

  private getDirectoryHierarchy(filePath: string, basePath: string): string[] {
    const directories: string[] = [];
    let currentDir = path.dirname(filePath);

    while (currentDir.startsWith(basePath)) {
      directories.push(currentDir);
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }

    return directories;
  }

  clearCache(): void {
    this.ignoreCache.clear();
    this.logger.debug("Cleared ignore filter cache");
  }
}
