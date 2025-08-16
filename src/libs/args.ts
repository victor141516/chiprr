import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

const options = {
  "sorted-directory": {
    type: "string",
    short: "s",
  },
  "tmdb-token": {
    type: "string",
    short: "t",
  },
  "input-directory": {
    type: "string",
    short: "i",
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
