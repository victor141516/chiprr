import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

const options = {
  "sorted-directory": {
    type: "string",
    short: "s",
    default: process.env.SORTED_DIRECTORY,
  },
  "tmdb-token": {
    type: "string",
    short: "t",
    default: process.env.TMDB_TOKEN,
  },
  "input-directory": {
    type: "string",
    short: "i",
    default: process.env.INPUT_DIRECTORY,
  },
  "log-level": {
    type: "string",
    short: "l",
    default: process.env.LOG_LEVEL ?? "info",
  },
} as const satisfies ParseArgsOptionsConfig;

export const { values: parameters } = parseArgs({ options }) as {
  values: Record<keyof typeof options, string>;
};

for (const key of Object.keys(options)) {
  if (!(key in parameters)) {
    throw new Error(`Missing required parameter: ${key}`);
  }
}
