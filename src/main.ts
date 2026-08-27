import { config } from "./config/parameters";
import { Logger } from "./infrastructure/logging/Logger";
import { TMDBClient } from "./infrastructure/tmdb/TMDBClient";
import { TMDBCache } from "./infrastructure/tmdb/TMDBCache";
import {
  runExecuteMode,
  runWatchMode,
} from "./application/MediaPipelineRunner";
import { createMediaPipelines } from "./application/createMediaPipelines";

async function main(): Promise<void> {
  const mainLogger = new Logger({ logLevel: config.logLevel, name: "Main" });
  const tmdbClient = new TMDBClient({
    apiToken: config.tmdbToken,
    cache: new TMDBCache({
      cacheFilePath: config.cacheFilePath,
      logger: new Logger({ logLevel: config.logLevel, name: "TMDBCache" }),
    }),
    logger: new Logger({ logLevel: config.logLevel, name: "TMDBClient" }),
  });
  const pipelines = createMediaPipelines(config, tmdbClient);

  if (config.mode === "execute") {
    await runExecuteMode(pipelines, mainLogger);
    return;
  }

  const fileWatchers = await runWatchMode(pipelines, mainLogger, {
    logLevel: config.logLevel,
  });
  const shutdown = () => {
    mainLogger.info("Shutting down chiprr...");
    for (const fileWatcher of fileWatchers) {
      fileWatcher.stop();
    }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  });
}
