import { configure, customConfigElement, printConfiguredSources } from "konfuz";
import { z } from "zod";
import { validateMovieDirectoryConfig } from "./validateConfig";

export interface AppConfig {
  inputDirectory: string;
  sortedDirectory: string;
  movieInputDirectory?: string;
  movieSortedDirectory?: string;
  tmdbToken: string;
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
  logLevel: customConfigElement({
    type: z.enum(["error", "warn", "info", "debug"]).default("info"),
    cmdDescription: "Log level",
  }),
  cacheFilePath: customConfigElement({
    type: z.string().default(".cache/tmdb-cache.jsonl"),
    cmdDescription: "Path to TMDB cache file",
  }),
  replaceIfExists: customConfigElement({
    type: z.boolean().default(false),
    envName: "REPLACE_IF_EXISTS",
    cmdName: "replace-if-exists",
    cmdNameShort: "f",
    cmdDescription: "Replace destination file if it already exists",
  }),
  mode: customConfigElement({
    type: z.enum(["watch", "execute"]).default("watch"),
    cmdDescription:
      "Execution mode: watch for continuous monitoring or execute for one-time scan",
  }),
});

const config = validateMovieDirectoryConfig(parsedConfig);

printConfiguredSources(config);

export { config };
