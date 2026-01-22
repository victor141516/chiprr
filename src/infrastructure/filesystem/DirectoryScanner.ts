import * as fs from "fs/promises";
import * as path from "path";
import { Logger } from "../logging/Logger";
import { IgnoreFilter } from "./IgnoreFilter";
import { config } from "../../config/parameters";

export class DirectoryScanner {
  private logger: Logger;
  private ignoreFilter: IgnoreFilter;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
    this.ignoreFilter = new IgnoreFilter({
      logger: new Logger({ logLevel: config.logLevel, name: "IgnoreFilter" }),
    });
  }

  async scanRecursively(directoryPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      await this.scanDirectory(directoryPath, files, directoryPath);
      this.logger.info(`Found ${files.length} files in ${directoryPath}`);
    } catch (error) {
      this.logger.error(`Error scanning directory: ${error}`);
      throw error;
    }

    return files;
  }

  private async scanDirectory(
    directoryPath: string,
    files: string[],
    basePath: string,
  ): Promise<void> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);

        // Check if path should be ignored (also handles .chiprrignore files)
        if (await this.ignoreFilter.shouldIgnore(fullPath, basePath)) {
          this.logger.debug(`Ignoring: ${fullPath}`);
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files, basePath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${directoryPath}: ${error}`);
      throw error;
    }
  }
}
