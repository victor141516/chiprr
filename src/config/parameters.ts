import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export interface AppConfig {
  inputDirectory: string;
  sortedDirectory: string;
  tmdbToken: string;
  logLevel: "error" | "warn" | "info" | "debug";
  cacheFilePath: string;
  mode: "watch" | "execute";
}

function parseArguments(): AppConfig {
  const argv = yargs(hideBin(process.argv))
    .option("input-directory", {
      alias: "i",
      type: "string",
      description: "Directory to watch for new video files",
      demandOption: false,
    })
    .option("sorted-directory", {
      alias: "s",
      type: "string",
      description: "Directory where organized files will be linked",
      demandOption: false,
    })
    .option("tmdb-token", {
      alias: "t",
      type: "string",
      description: "TMDB API token",
      demandOption: false,
    })
    .option("log-level", {
      alias: "l",
      type: "string",
      description: "Log level",
      choices: ["error", "warn", "info", "debug"] as const,
      default: "info" as const,
    })
    .option("cache-file-path", {
      alias: "c",
      type: "string",
      description: "Path to TMDB cache file",
      demandOption: false,
    })
    .option("mode", {
      alias: "m",
      type: "string",
      description:
        "Execution mode: watch for continuous monitoring or execute for one-time scan",
      choices: ["watch", "execute"] as const,
      default: "watch" as const,
    })
    .parseSync();

  const inputDirectory = argv["input-directory"] || process.env.INPUT_DIRECTORY;
  const sortedDirectory =
    argv["sorted-directory"] || process.env.SORTED_DIRECTORY;
  const tmdbToken = argv["tmdb-token"] || process.env.TMDB_TOKEN;
  const logLevel = (argv["log-level"] ||
    process.env.LOG_LEVEL ||
    "info") as AppConfig["logLevel"];
  const cacheFilePath =
    argv["cache-file-path"] ||
    process.env.CACHE_FILE_PATH ||
    ".cache/tmdb-cache.jsonl";
  const mode = argv["mode"] as AppConfig["mode"];

  if (!inputDirectory) {
    throw new Error(
      "Input directory is required. Provide via --input-directory or INPUT_DIRECTORY env var",
    );
  }

  if (!sortedDirectory) {
    throw new Error(
      "Sorted directory is required. Provide via --sorted-directory or SORTED_DIRECTORY env var",
    );
  }

  if (!tmdbToken) {
    throw new Error(
      "TMDB token is required. Provide via --tmdb-token or TMDB_TOKEN env var",
    );
  }

  return {
    inputDirectory,
    sortedDirectory,
    tmdbToken,
    logLevel,
    cacheFilePath,
    mode,
  };
}

export const config = parseArguments();
