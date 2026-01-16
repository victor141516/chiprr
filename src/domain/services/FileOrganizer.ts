import { Logger } from "../../infrastructure/logging/Logger";
import { HardLinkCreator } from "../../infrastructure/filesystem/HardLinkCreator";
import { VideoFileParser } from "./VideoFileParser";
import { ShowMatcher } from "./ShowMatcher";

/**
 * This is the main functionality.
 * It takes a file path and creates the hard link to the destination directory.
 */
export class FileOrganizer {
  private isVideoFile: (path: string) => boolean;
  private videoFileParser: VideoFileParser;
  private showMatcher: ShowMatcher;
  private hardLinkCreator: HardLinkCreator;
  private logger: Logger;

  constructor({
    isVideoFile,
    videoFileParser,
    showMatcher,
    hardLinkCreator,
    logger,
  }: {
    isVideoFile: (path: string) => boolean;
    videoFileParser: VideoFileParser;
    showMatcher: ShowMatcher;
    hardLinkCreator: HardLinkCreator;
    logger: Logger;
  }) {
    this.isVideoFile = isVideoFile;
    this.videoFileParser = videoFileParser;
    this.showMatcher = showMatcher;
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

      // Parse the filename to extract episode info and parent directories
      const { parentDirectories, ...episodeInfo } =
        this.videoFileParser.parse(filePath);

      // Match the show name with TMDB, using parent directories if needed
      const matchedInfo = await this.showMatcher.match(
        episodeInfo,
        parentDirectories
      );

      // Create hard link in organized structure
      await this.hardLinkCreator.createLink(filePath, matchedInfo);

      this.logger.info(`Successfully organized: ${filePath}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to organize file ${filePath}: ${error.message}`
        );
        throw error;
      }
      throw new Error(`Unknown error organizing file: ${filePath}`);
    }
  }
}
