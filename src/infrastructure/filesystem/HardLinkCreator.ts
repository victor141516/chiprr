import * as fs from "fs/promises";
import path from "path";
import type { MatchedMedia } from "../../domain/models/MatchedMedia";
import { buildDestinationPath } from "../../domain/services/MediaPathBuilder";
import { Logger } from "../logging/Logger";

export class HardLinkCreator {
  private sortedDirectory: string;
  private replaceIfExists: boolean;
  private logger: Logger;

  constructor({
    sortedDirectory,
    replaceIfExists,
    logger,
  }: {
    sortedDirectory: string;
    replaceIfExists: boolean;
    logger: Logger;
  }) {
    this.sortedDirectory = sortedDirectory;
    this.replaceIfExists = replaceIfExists;
    this.logger = logger;
  }

  async createLink(originalPath: string, media: MatchedMedia): Promise<void> {
    const destinationPath = buildDestinationPath({
      sortedDirectory: this.sortedDirectory,
      originalPath,
      media,
    });
    const parentDir = path.dirname(destinationPath);

    await fs.mkdir(parentDir, { recursive: true });

    this.logger.info(`Linking "${originalPath}" to "${destinationPath}"`);

    if (this.replaceIfExists) {
      try {
        await fs.unlink(destinationPath);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          // There is no old link to remove.
        } else {
          throw error;
        }
      }
    }

    try {
      await fs.link(originalPath, destinationPath);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to create hard link: ${error.message}`);
        throw error;
      }
      throw new Error("Unknown error creating hard link");
    }
  }
}
