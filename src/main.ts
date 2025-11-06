import { config } from "./config/parameters";
import { Logger } from "./infrastructure/logging/Logger";
import { FileWatcher } from "./infrastructure/filesystem/FileWatcher";
import { HardLinkCreator } from "./infrastructure/filesystem/HardLinkCreator";
import { TMDBClient } from "./infrastructure/tmdb/TMDBClient";
import { VideoFileParser } from "./domain/services/VideoFileParser";
import { ShowMatcher } from "./domain/services/ShowMatcher";
import { FileOrganizer } from "./domain/services/FileOrganizer";
import { isVideoFile } from "./utils/isVideoFile";
import { TMDBCache } from "./infrastructure/tmdb/TMDBCache";

async function main() {
  // Initialize infrastructure
  const mainLogger = new Logger({ logLevel: config.logLevel, name: "Main" });
  const hardLinkCreator = new HardLinkCreator({
    sortedDirectory: config.sortedDirectory,
    logger: new Logger({ logLevel: config.logLevel, name: "HardLinkCreator" }),
  });
  const tmdbClient = new TMDBClient({
    apiToken: config.tmdbToken,
    cache: new TMDBCache(config.cacheFilePath),
    logger: new Logger({ logLevel: config.logLevel, name: "TMDBClient" }),
  });

  // Initialize domain services
  const videoFileParser = new VideoFileParser({
    logger: new Logger({ logLevel: config.logLevel, name: "VideoFileParser" }),
  });
  const showMatcher = new ShowMatcher({
    tmdbClient,
    logger: new Logger({ logLevel: config.logLevel, name: "ShowMatcher" }),
  });
  const fileOrganizer = new FileOrganizer({
    isVideoFile,
    videoFileParser,
    showMatcher,
    hardLinkCreator,
    logger: new Logger({ logLevel: config.logLevel, name: "FileOrganizer" }),
  });

  // Initialize file watcher
  const fileWatcher = new FileWatcher({
    directoryPath: config.inputDirectory,
    logger: new Logger({ logLevel: config.logLevel, name: "FileWatcher" }),
  });
  const watcher = await fileWatcher.start();

  watcher.on("ready", () => {
    mainLogger.info("chiprr is ready");
  });

  watcher.on("fileCreated", async ({ filePath }) => {
    try {
      await fileOrganizer.organize(filePath);
    } catch (error) {
      // Error already logged by FileOrganizer
    }
  });

  watcher.on("error", ({ message, error }) => {
    mainLogger.error(error);
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    mainLogger.info("Shutting down chiprr...");
    fileWatcher.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    mainLogger.info("Shutting down chiprr...");
    fileWatcher.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
