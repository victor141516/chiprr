import { Logger } from "../../infrastructure/logging/Logger";
import { HardLinkCreator } from "../../infrastructure/filesystem/HardLinkCreator";
import type { MatchedMedia } from "../models/MatchedMedia";

export interface MediaParser<TParsed> {
  parse(filePath: string): TParsed;
}

export interface MediaMatcher<TParsed> {
  match(parsed: TParsed): Promise<MatchedMedia>;
}

/**
 * This is the main functionality.
 * It takes a file path and creates the hard link to the destination directory.
 */
export class FileOrganizer<TParsed = unknown> {
  private isVideoFile: (path: string) => boolean;
  private mediaParser: MediaParser<TParsed>;
  private mediaMatcher: MediaMatcher<TParsed>;
  private hardLinkCreator: HardLinkCreator;
  private logger: Logger;

  constructor({
    isVideoFile,
    mediaParser,
    mediaMatcher,
    hardLinkCreator,
    logger,
  }: {
    isVideoFile: (path: string) => boolean;
    mediaParser: MediaParser<TParsed>;
    mediaMatcher: MediaMatcher<TParsed>;
    hardLinkCreator: HardLinkCreator;
    logger: Logger;
  }) {
    this.isVideoFile = isVideoFile;
    this.mediaParser = mediaParser;
    this.mediaMatcher = mediaMatcher;
    this.hardLinkCreator = hardLinkCreator;
    this.logger = logger;
  }

  async organize(filePath: string): Promise<void> {
    try {
      // Check if it's a video file
      if (!this.isVideoFile(filePath)) {
        this.logger.debug(`Skipping non-video file: ${filePath}`);
        return;
      }

      const parsedMedia = this.mediaParser.parse(filePath);

      const matchedInfo = await this.mediaMatcher.match(parsedMedia);

      // Create hard link in organized structure
      await this.hardLinkCreator.createLink(filePath, matchedInfo);

      this.logger.info(`Successfully organized: ${filePath}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to organize file ${filePath}: ${error.message}`,
        );
        throw error;
      }
      throw new Error(`Unknown error organizing file: ${filePath}`);
    }
  }
}
