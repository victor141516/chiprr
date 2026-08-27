import mitt from "mitt";
import { describe, expect, it, vi } from "vitest";
import { Logger } from "../infrastructure/logging/Logger";
import type { FileWatcherEvents } from "../infrastructure/filesystem/FileWatcher";
import {
  runExecuteMode,
  runWatchMode,
  type FileWatcherLike,
  type MediaPipeline,
  type PipelineKind,
} from "./MediaPipelineRunner";

function pipeline(
  kind: PipelineKind,
  inputDirectory: string,
  organize: (filePath: string) => Promise<void>,
): MediaPipeline {
  return { kind, inputDirectory, organizer: { organize } };
}

describe("MediaPipelineRunner", () => {
  const logger = new Logger({ logLevel: "error", name: "PipelineRunnerTest" });

  it("executes show and movie scans independently", async () => {
    const organizeShow = vi.fn().mockResolvedValue(undefined);
    const organizeMovie = vi
      .fn()
      .mockRejectedValueOnce(new Error("bad movie"))
      .mockResolvedValueOnce(undefined);
    const scanner = {
      scanRecursively: vi.fn(async (directory: string) =>
        directory === "/shows"
          ? ["/shows/Show.S01E01.mkv", "/shows/notes.txt"]
          : ["/movies/Bad.mkv", "/movies/Arrival.mp4"],
      ),
    };

    const summary = await runExecuteMode(
      [
        pipeline("show", "/shows", organizeShow),
        pipeline("movie", "/movies", organizeMovie),
      ],
      logger,
      scanner,
    );

    expect(scanner.scanRecursively).toHaveBeenCalledTimes(2);
    expect(organizeShow).toHaveBeenCalledWith("/shows/Show.S01E01.mkv");
    expect(organizeMovie).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({
      successful: { show: 1, movie: 1 },
      failed: { show: 0, movie: 1 },
    });
  });

  it("starts both watchers without implicitly organizing existing files", async () => {
    const organizeShow = vi.fn().mockRejectedValue(new Error("isolated"));
    const organizeMovie = vi.fn().mockResolvedValue(undefined);
    const emitters = new Map<
      PipelineKind,
      ReturnType<typeof mitt<FileWatcherEvents>>
    >();
    const stopped: PipelineKind[] = [];

    const watchers = await runWatchMode(
      [
        pipeline("show", "/shows", organizeShow),
        pipeline("movie", "/movies", organizeMovie),
      ],
      logger,
      {
        logLevel: "error",
        fileWatcherFactory: (mediaPipeline): FileWatcherLike => {
          const emitter = mitt<FileWatcherEvents>();
          emitters.set(mediaPipeline.kind, emitter);
          return {
            async start() {
              return emitter;
            },
            stop() {
              stopped.push(mediaPipeline.kind);
            },
          };
        },
      },
    );

    expect(organizeShow).not.toHaveBeenCalled();
    expect(organizeMovie).not.toHaveBeenCalled();

    emitters.get("show")!.emit("fileCreated", {
      filePath: "/shows/new.mkv",
      fileName: "new.mkv",
      timestamp: new Date(),
    });
    emitters.get("movie")!.emit("fileCreated", {
      filePath: "/movies/new.mkv",
      fileName: "new.mkv",
      timestamp: new Date(),
    });
    await Promise.resolve();
    expect(organizeShow).toHaveBeenCalledWith("/shows/new.mkv");
    expect(organizeMovie).toHaveBeenCalledWith("/movies/new.mkv");

    for (const watcher of watchers) {
      watcher.stop();
    }
    expect(stopped).toEqual(["show", "movie"]);
  });

  it("continues the movie execute pipeline if the show scan fails", async () => {
    const organizeShow = vi.fn().mockResolvedValue(undefined);
    const organizeMovie = vi.fn().mockResolvedValue(undefined);
    const scanner = {
      scanRecursively: vi
        .fn()
        .mockRejectedValueOnce(new Error("show directory unavailable"))
        .mockResolvedValueOnce(["/movies/Arrival.mkv"]),
    };

    const summary = await runExecuteMode(
      [
        pipeline("show", "/shows", organizeShow),
        pipeline("movie", "/movies", organizeMovie),
      ],
      logger,
      scanner,
    );

    expect(organizeShow).not.toHaveBeenCalled();
    expect(organizeMovie).toHaveBeenCalledWith("/movies/Arrival.mkv");
    expect(summary).toEqual({
      successful: { show: 0, movie: 1 },
      failed: { show: 1, movie: 0 },
    });
  });

  it("continues starting watchers if one pipeline cannot start", async () => {
    const organizeShow = vi.fn().mockResolvedValue(undefined);
    const organizeMovie = vi.fn().mockResolvedValue(undefined);
    const movieEmitter = mitt<FileWatcherEvents>();

    const watchers = await runWatchMode(
      [
        pipeline("show", "/shows", organizeShow),
        pipeline("movie", "/movies", organizeMovie),
      ],
      logger,
      {
        logLevel: "error",
        fileWatcherFactory: (mediaPipeline) => ({
          async start() {
            if (mediaPipeline.kind === "show") {
              throw new Error("show watcher failed");
            }
            return movieEmitter;
          },
          stop() {},
        }),
      },
    );

    expect(watchers).toHaveLength(1);
    movieEmitter.emit("fileCreated", {
      filePath: "/movies/new.mkv",
      fileName: "new.mkv",
      timestamp: new Date(),
    });
    await Promise.resolve();
    expect(organizeMovie).toHaveBeenCalledWith("/movies/new.mkv");
  });
});
