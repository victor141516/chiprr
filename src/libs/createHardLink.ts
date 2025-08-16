import * as fs from "fs/promises";
import path from "path";
import type { EpisodeInfo } from "./parseVideoFileName/parseVideoFileName";

export async function createHardLink(
  original: string,
  sinkDirectory: string,
  episodeInfo: EpisodeInfo
) {
  const extension = original.split(".").at(-1)!;

  const parentDir = path.join(
    sinkDirectory,
    episodeInfo!.showName,
    `Season ${episodeInfo!.season}`
  );

  await fs.mkdir(parentDir, { recursive: true });

  const fileName = `${episodeInfo!.showName} S${episodeInfo!.season
    .toString()
    .padStart(2, "0")}E${episodeInfo!.episode
    .toString()
    .padStart(2, "0")}.${extension}`;
  const destinationPath = path.join(parentDir, fileName);

  console.log('Linking "', original, '" to "', destinationPath, '"');
  await fs.link(original, destinationPath);
}
