import ignore, { type Ignore } from "ignore";
import * as fs from "fs/promises";
import * as path from "path";
import { Logger } from "../logging/Logger";

const IGNORE_FILENAME = ".chiprrignore";

export class IgnoreFilter {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  async shouldIgnore(filePath: string, basePath: string): Promise<boolean> {
    // Skip .chiprrignore files themselves
    if (path.basename(filePath) === IGNORE_FILENAME) return true;

    const relativePath = path.relative(basePath, filePath);
    const directories = this.getDirectoryHierarchy(relativePath);
    this.logger.debug(`directories: ${JSON.stringify(directories)}`);

    for (const dir of directories) {
      const ignoreRules = await this.getIgnoreRules(path.join(basePath, dir));
      this.logger.debug(`Ignore rules: ${JSON.stringify(ignoreRules)}`);
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
    const ignoreFilePath = path.join(directory, IGNORE_FILENAME);

    let content!: string;
    try {
      content = await fs.readFile(ignoreFilePath, "utf-8");
    } catch (error) {
      // No .chiprrignore file in this directory
      return null;
    }

    if (content.trim() === "") {
      // Empty file means ignore everything
      this.logger.debug(
        `Found empty .chiprrignore in ${directory} - ignoring all files`,
      );
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
    return ig;
  }

  private getDirectoryHierarchy(relativePath: string): string[] {
    const directories: string[] = [""]; // Include root (basePath itself)
    let currentDir = path.dirname(relativePath);

    while (currentDir !== "." && currentDir !== "/") {
      directories.push(currentDir);
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }

    return directories;
  }
}
