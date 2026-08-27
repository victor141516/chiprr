import * as fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HardLinkCreator } from "../../infrastructure/filesystem/HardLinkCreator";
import { Logger } from "../../infrastructure/logging/Logger";
import { isVideoFile } from "../../utils/isVideoFile";
import { FileOrganizer } from "./FileOrganizer";
import { MovieFileParser } from "./MovieFileParser";
import { MovieMatcher, type MovieSearchClient } from "./MovieMatcher";

describe("movie organization pipeline", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "chiprr-movie-"),
    );
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("parses, matches, and hard-links a nested localized movie", async () => {
    const completedDirectory = path.join(
      temporaryDirectory,
      "completed",
      "release-folder",
    );
    const libraryDirectory = path.join(temporaryDirectory, "library");
    await fs.mkdir(completedDirectory, { recursive: true });
    const source = path.join(
      completedDirectory,
      "El.laberinto.del.fauno.2006.1080p.BluRay.x264.mkv",
    );
    await fs.writeFile(source, "movie");

    const logger = new Logger({ logLevel: "error", name: "MoviePipelineTest" });
    const tmdbClient: MovieSearchClient = {
      async searchMovie() {
        return [
          {
            id: 1417,
            title: "Pan's Labyrinth",
            originalTitle: "El laberinto del fauno",
            names: ["pan's labyrinth", "el laberinto del fauno"],
            year: 2006,
          },
        ];
      },
    };
    const organizer = new FileOrganizer({
      isVideoFile,
      mediaParser: new MovieFileParser(),
      mediaMatcher: new MovieMatcher({ tmdbClient, logger }),
      hardLinkCreator: new HardLinkCreator({
        sortedDirectory: libraryDirectory,
        replaceIfExists: false,
        logger,
      }),
      logger,
    });

    await organizer.organize(source);

    const destination = path.join(
      libraryDirectory,
      "Pan's Labyrinth (2006).mkv",
    );
    const [sourceStat, destinationStat] = await Promise.all([
      fs.stat(source),
      fs.stat(destination),
    ]);
    expect(destinationStat.ino).toBe(sourceStat.ino);
    await expect(fs.readFile(destination, "utf8")).resolves.toBe("movie");
  });
});
