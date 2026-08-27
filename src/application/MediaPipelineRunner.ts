import type { Emitter } from "mitt";
import { DirectoryScanner } from "../infrastructure/filesystem/DirectoryScanner";
import {
  FileWatcher,
  type FileWatcherEvents,
} from "../infrastructure/filesystem/FileWatcher";
import { Logger } from "../infrastructure/logging/Logger";
import { isVideoFile } from "../utils/isVideoFile";

export type PipelineKind = "show" | "movie";
export type LogLevel = "error" | "warn" | "info" | "debug";

export interface Organizer {
  organize(filePath: string): Promise<void>;
}

export interface MediaPipeline {
  kind: PipelineKind;
  inputDirectory: string;
  organizer: Organizer;
}

export interface ExecuteSummary {
  successful: Record<PipelineKind, number>;
  failed: Record<PipelineKind, number>;
}

export interface DirectoryScannerLike {
  scanRecursively(directoryPath: string): Promise<string[]>;
}

export interface FileWatcherLike {
  start(): Promise<Emitter<FileWatcherEvents>>;
  stop(): void;
}

export type FileWatcherFactory = (pipeline: MediaPipeline) => FileWatcherLike;

export async function runExecuteMode(
  pipelines: MediaPipeline[],
  mainLogger: Logger,
  directoryScanner: DirectoryScannerLike = new DirectoryScanner({
    logger: mainLogger,
  }),
): Promise<ExecuteSummary> {
  const summary: ExecuteSummary = {
    successful: { show: 0, movie: 0 },
    failed: { show: 0, movie: 0 },
  };

  for (const pipeline of pipelines) {
    mainLogger.info(
      `Scanning ${pipeline.kind} input directory: ${pipeline.inputDirectory}`,
    );
    let allFiles: string[];
    try {
      allFiles = await directoryScanner.scanRecursively(
        pipeline.inputDirectory,
      );
    } catch (error) {
      summary.failed[pipeline.kind]++;
      mainLogger.error(
        `Failed to scan ${pipeline.kind} input directory ${pipeline.inputDirectory}: ${error}`,
      );
      continue;
    }
    const videoFiles = allFiles.filter((filePath) => isVideoFile(filePath));
    mainLogger.info(
      `Found ${videoFiles.length} ${pipeline.kind} video files to process`,
    );

    for (const filePath of videoFiles) {
      try {
        await pipeline.organizer.organize(filePath);
        summary.successful[pipeline.kind]++;
      } catch {
        summary.failed[pipeline.kind]++;
        // FileOrganizer already logged the contextual error.
      }
    }
  }

  mainLogger.info(
    `Execute mode completed: shows=${summary.successful.show} successful/${summary.failed.show} failed, movies=${summary.successful.movie} successful/${summary.failed.movie} failed`,
  );
  return summary;
}

export async function runWatchMode(
  pipelines: MediaPipeline[],
  mainLogger: Logger,
  {
    logLevel,
    fileWatcherFactory = (pipeline) =>
      new FileWatcher({
        directoryPath: pipeline.inputDirectory,
        logger: new Logger({
          logLevel,
          name: `${pipeline.kind}FileWatcher`,
        }),
      }),
  }: {
    logLevel: LogLevel;
    fileWatcherFactory?: FileWatcherFactory;
  },
): Promise<FileWatcherLike[]> {
  const fileWatchers: FileWatcherLike[] = [];

  for (const pipeline of pipelines) {
    const fileWatcher = fileWatcherFactory(pipeline);
    let watcher: Emitter<FileWatcherEvents>;
    try {
      watcher = await fileWatcher.start();
    } catch (error) {
      mainLogger.error(
        `Failed to start ${pipeline.kind} watcher for ${pipeline.inputDirectory}: ${error}`,
      );
      continue;
    }

    watcher.on("ready", () => {
      mainLogger.info(`chiprr ${pipeline.kind} pipeline is ready (watch mode)`);
    });
    watcher.on("fileCreated", async ({ filePath }) => {
      try {
        await pipeline.organizer.organize(filePath);
      } catch {
        // A pipeline/file failure is isolated and already logged.
      }
    });
    watcher.on("error", ({ message, error }) => {
      mainLogger.error(
        `${pipeline.kind} watcher: ${message}: ${error.message}`,
      );
    });

    fileWatchers.push(fileWatcher);
  }

  return fileWatchers;
}
