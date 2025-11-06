import * as fs from "fs/promises";
import path from "path";
import type { EpisodeInfo } from "../../domain/models/EpisodeInfo";
import { Logger } from "../logging/Logger";

export class HardLinkCreator {
  private sortedDirectory: string;
  private logger: Logger;

  constructor({
    sortedDirectory,
    logger,
  }: {
    sortedDirectory: string;
    logger: Logger;
  }) {
    this.sortedDirectory = sortedDirectory;
    this.logger = logger;
  }

  async createLink(
    originalPath: string,
    episodeInfo: EpisodeInfo
  ): Promise<void> {
    const extension = originalPath.split(".").at(-1)!;

    const parentDir = path.join(
      this.sortedDirectory,
      episodeInfo.showName,
      `Season ${episodeInfo.season}`
    );

    await fs.mkdir(parentDir, { recursive: true });

    const fileName = `${episodeInfo.showName} S${episodeInfo.season
      .toString()
      .padStart(2, "0")}E${episodeInfo.episode
      .toString()
      .padStart(2, "0")}.${extension}`;
    const destinationPath = path.join(parentDir, fileName);

    this.logger.info(`Linking "${originalPath}" to "${destinationPath}"`);

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
