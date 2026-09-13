import { configure, customConfigElement, printConfiguredSources } from "konfuz";
import { z } from "zod";
import { validateMovieDirectoryConfig } from "./validateConfig";

export interface AppConfig {
  inputDirectory: string;
  sortedDirectory: string;
  movieInputDirectory?: string;
  movieSortedDirectory?: string;
  tmdbToken: string;
  tmdbBaseUrl: string;
  logLevel: "error" | "warn" | "info" | "debug";
  cacheFilePath: string;
  replaceIfExists: boolean;
  mode: "watch" | "execute";
}

const parsedConfig = configure({
  inputDirectory: customConfigElement({
    type: z.string(),
    cmdDescription: "Directory to watch for new video files",
  }),
  sortedDirectory: customConfigElement({
    type: z.string(),
    cmdDescription: "Directory where organized files will be linked",
  }),
  movieInputDirectory: customConfigElement({
    type: z.string().trim().min(1).optional(),
    cmdDescription: "Directory to watch for completed movie downloads",
  }),
  movieSortedDirectory: customConfigElement({
    type: z.string().trim().min(1).optional(),
    cmdDescription: "Directory where organized movie files will be linked",
  }),
  tmdbToken: customConfigElement({
    type: z.string(),
    cmdDescription: "TMDB API token",
    secret: true,
  }),
  tmdbBaseUrl: customConfigElement({
    type: z.string().url().optional(),
    cmdDescription: "TMDB API base URL",
  }),
  logLevel: customConfigElement({
    type: z.enum(["error", "warn", "info", "debug"]).optional(),
    cmdDescription: "Log level",
  }),
  cacheFilePath: customConfigElement({
    type: z.string().optional(),
    cmdDescription: "Path to TMDB cache file",
  }),
  replaceIfExists: customConfigElement({
    type: z.boolean().optional(),
    envName: "REPLACE_IF_EXISTS",
    cmdName: "replace-if-exists",
    cmdNameShort: "f",
    cmdDescription: "Replace destination file if it already exists",
  }),
  mode: customConfigElement({
    type: z.enum(["watch", "execute"]).optional(),
    cmdDescription:
      "Execution mode: watch for continuous monitoring or execute for one-time scan",
  }),
});

// konfuz 2.0 currently reports environment overrides for Zod defaulted
// fields but returns the schema default. Apply defaults after source parsing
// so environment and CLI values retain their documented precedence.
const config: AppConfig = validateMovieDirectoryConfig({
  ...parsedConfig,
  tmdbBaseUrl:
    parsedConfig.tmdbBaseUrl ?? "https://api.themoviedb.org/3",
  logLevel: parsedConfig.logLevel ?? "info",
  cacheFilePath: parsedConfig.cacheFilePath ?? ".cache/tmdb-cache.jsonl",
  replaceIfExists: parsedConfig.replaceIfExists ?? false,
  mode: parsedConfig.mode ?? "watch",
});

printConfiguredSources(config);

export { config };
