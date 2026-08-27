import type { AppConfig } from "../config/parameters";
import { FileOrganizer } from "../domain/services/FileOrganizer";
import { MovieFileParser } from "../domain/services/MovieFileParser";
import { MovieMatcher } from "../domain/services/MovieMatcher";
import { ShowMatcher } from "../domain/services/ShowMatcher";
import { VideoFileParser } from "../domain/services/VideoFileParser";
import { HardLinkCreator } from "../infrastructure/filesystem/HardLinkCreator";
import { Logger } from "../infrastructure/logging/Logger";
import type { TMDBClient } from "../infrastructure/tmdb/TMDBClient";
import { isVideoFile } from "../utils/isVideoFile";
import type { MediaPipeline } from "./MediaPipelineRunner";

export function createMediaPipelines(
  appConfig: AppConfig,
  tmdbClient: TMDBClient,
): MediaPipeline[] {
  const videoFileParser = new VideoFileParser({
    logger: new Logger({
      logLevel: appConfig.logLevel,
      name: "VideoFileParser",
    }),
  });
  const showMatcher = new ShowMatcher({
    tmdbClient,
    logger: new Logger({ logLevel: appConfig.logLevel, name: "ShowMatcher" }),
  });
  const showOrganizer = new FileOrganizer({
    isVideoFile,
    mediaParser: videoFileParser,
    mediaMatcher: showMatcher,
    hardLinkCreator: new HardLinkCreator({
      sortedDirectory: appConfig.sortedDirectory,
      replaceIfExists: appConfig.replaceIfExists,
      logger: new Logger({
        logLevel: appConfig.logLevel,
        name: "ShowHardLinkCreator",
      }),
    }),
    logger: new Logger({
      logLevel: appConfig.logLevel,
      name: "ShowFileOrganizer",
    }),
  });

  const pipelines: MediaPipeline[] = [
    {
      kind: "show",
      inputDirectory: appConfig.inputDirectory,
      organizer: showOrganizer,
    },
  ];

  if (appConfig.movieInputDirectory && appConfig.movieSortedDirectory) {
    const movieParser = new MovieFileParser();
    const movieMatcher = new MovieMatcher({
      tmdbClient,
      logger: new Logger({
        logLevel: appConfig.logLevel,
        name: "MovieMatcher",
      }),
    });
    pipelines.push({
      kind: "movie",
      inputDirectory: appConfig.movieInputDirectory,
      organizer: new FileOrganizer({
        isVideoFile,
        mediaParser: movieParser,
        mediaMatcher: movieMatcher,
        hardLinkCreator: new HardLinkCreator({
          sortedDirectory: appConfig.movieSortedDirectory,
          replaceIfExists: appConfig.replaceIfExists,
          logger: new Logger({
            logLevel: appConfig.logLevel,
            name: "MovieHardLinkCreator",
          }),
        }),
        logger: new Logger({
          logLevel: appConfig.logLevel,
          name: "MovieFileOrganizer",
        }),
      }),
    });
  }

  return pipelines;
}
