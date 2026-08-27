import { describe, expect, it } from "vitest";
import type { AppConfig } from "../config/parameters";
import type { TMDBClient } from "../infrastructure/tmdb/TMDBClient";
import { createMediaPipelines } from "./createMediaPipelines";

const baseConfig: AppConfig = {
  inputDirectory: "/completed/shows",
  sortedDirectory: "/library/shows",
  tmdbToken: "token",
  logLevel: "error",
  cacheFilePath: "/cache/tmdb.jsonl",
  replaceIfExists: false,
  mode: "watch",
};

describe("createMediaPipelines", () => {
  it("preserves show-only behavior when movie directories are absent", () => {
    const pipelines = createMediaPipelines(baseConfig, {} as TMDBClient);

    expect(
      pipelines.map(({ kind, inputDirectory }) => ({ kind, inputDirectory })),
    ).toEqual([{ kind: "show", inputDirectory: "/completed/shows" }]);
  });

  it("creates independent show and movie pipelines when configured", () => {
    const pipelines = createMediaPipelines(
      {
        ...baseConfig,
        movieInputDirectory: "/completed/movies",
        movieSortedDirectory: "/library/movies",
      },
      {} as TMDBClient,
    );

    expect(
      pipelines.map(({ kind, inputDirectory }) => ({ kind, inputDirectory })),
    ).toEqual([
      { kind: "show", inputDirectory: "/completed/shows" },
      { kind: "movie", inputDirectory: "/completed/movies" },
    ]);
  });
});
