import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const options = {
  "sorted-directory": {
    alias: "s",
    default: process.env.SORTED_DIRECTORY,
    demandOption: true,
    describe: "The directory where the sorted files will be moved",
    type: "string",
  },
  "tmdb-token": {
    alias: "t",
    default: process.env.TMDB_TOKEN,
    demandOption: true,
    describe: "The TMDB token",
    type: "string",
  },
  "input-directory": {
    alias: "i",
    default: process.env.INPUT_DIRECTORY,
    demandOption: true,
    describe: "The directory to watch for new files",
    type: "string",
  },
  "log-level": {
    alias: "l",
    default: process.env.LOG_LEVEL ?? "info",
    describe: "The log level",
    type: "string",
  },
  "dry-run": {
    alias: "d",
    default: (process.env.DRY_RUN ?? "false") === "true",
    describe: "Dry run",
    type: "boolean",
  },
} as const;

export const parameters = yargs(hideBin(process.argv))
  .options(options)
  .parseSync();
