import * as fs from "fs/promises";
import * as path from "path";
import { Logger } from "../logging/Logger";

export class DirectoryScanner {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  async scanRecursively(directoryPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      await this.scanDirectory(directoryPath, files);
      this.logger.info(`Found ${files.length} files in ${directoryPath}`);
    } catch (error) {
      this.logger.error(`Error scanning directory: ${error}`);
      throw error;
    }

    return files;
  }

  private async scanDirectory(
    directoryPath: string,
    files: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files);
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
