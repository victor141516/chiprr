import { configure, customConfigElement } from "konfuz";
import { z } from "zod";

export interface AppConfig {
  inputDirectory: string;
  sortedDirectory: string;
  tmdbToken: string;
  logLevel: "error" | "warn" | "info" | "debug";
  cacheFilePath: string;
  replaceIfExtists: boolean;
  mode: "watch" | "execute";
}

const config = configure({
  inputDirectory: customConfigElement(z.string(), {
    cmdDescription: "Directory to watch for new video files",
  }),
  sortedDirectory: customConfigElement(z.string(), {
    cmdDescription: "Directory where organized files will be linked",
  }),
  tmdbToken: customConfigElement(z.string(), {
    cmdDescription: "TMDB API token",
  }),
  logLevel: customConfigElement(
    z.enum(["error", "warn", "info", "debug"]).default("info"),
    {
      cmdDescription: "Log level",
    },
  ),
  cacheFilePath: customConfigElement(
    z.string().default(".cache/tmdb-cache.jsonl"),
    {
      cmdDescription: "Path to TMDB cache file",
    },
  ),
  replaceIfExtists: customConfigElement(z.boolean().default(false), {
    cmdNameShort: "f",
    cmdDescription: "Replace destination file if it already exists",
  }),
  mode: customConfigElement(z.enum(["watch", "execute"]).default("watch"), {
    cmdDescription:
      "Execution mode: watch for continuous monitoring or execute for one-time scan",
  }),
});

export { config };
