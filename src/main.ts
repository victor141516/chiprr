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
import { DirectoryScanner } from "./infrastructure/filesystem/DirectoryScanner";

async function runWatchMode(fileOrganizer: FileOrganizer, mainLogger: Logger) {
  // Initialize file watcher
  const fileWatcher = new FileWatcher({
    directoryPath: config.inputDirectory,
    logger: new Logger({ logLevel: config.logLevel, name: "FileWatcher" }),
  });
  const watcher = await fileWatcher.start();

  watcher.on("ready", () => {
    mainLogger.info("chiprr is ready (watch mode)");
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

async function runExecuteMode(
  fileOrganizer: FileOrganizer,
  mainLogger: Logger,
) {
  mainLogger.info("Starting execute mode - scanning input directory...");

  const directoryScanner = new DirectoryScanner({
    logger: new Logger({
      logLevel: config.logLevel,
      name: "DirectoryScanner",
    }),
  });

  // Scan directory recursively
  const allFiles = await directoryScanner.scanRecursively(
    config.inputDirectory,
  );

  // Filter video files
  const videoFiles = allFiles.filter((filePath) => isVideoFile(filePath));
  mainLogger.info(`Found ${videoFiles.length} video files to process`);

  // Process each video file
  let successCount = 0;
  let errorCount = 0;

  for (const filePath of videoFiles) {
    try {
      await fileOrganizer.organize(filePath);
      successCount++;
    } catch (error) {
      errorCount++;
      // Error already logged by FileOrganizer
    }
  }

  mainLogger.info(
    `Execute mode completed: ${successCount} files processed successfully, ${errorCount} errors`,
  );
  process.exit(0);
}

async function main() {
  // Initialize infrastructure
  const mainLogger = new Logger({ logLevel: config.logLevel, name: "Main" });
  const hardLinkCreator = new HardLinkCreator({
    sortedDirectory: config.sortedDirectory,
    logger: new Logger({ logLevel: config.logLevel, name: "HardLinkCreator" }),
  });
  const tmdbClient = new TMDBClient({
    apiToken: config.tmdbToken,
    cache: new TMDBCache({
      cacheFilePath: config.cacheFilePath,
      logger: new Logger({ logLevel: config.logLevel, name: "TMDBCache" }),
    }),
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

  // Run appropriate mode
  if (config.mode === "execute") {
    await runExecuteMode(fileOrganizer, mainLogger);
  } else {
    await runWatchMode(fileOrganizer, mainLogger);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
