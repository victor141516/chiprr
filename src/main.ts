import { parameters } from "./libs/args";
import { createHardLink } from "./libs/createHardLink";
import { createFileWatcher } from "./libs/fileWatcher";
import { isVideoFile } from "./libs/filterVideoFiles";
import { fuzzyMatch } from "./libs/fuzzyMatcher";
import { logger } from "./libs/logger";
import {
  parseVideoFileName,
  type EpisodeInfo,
} from "./libs/parseVideoFileName/parseVideoFileName";
import { removeDiacritics } from "./libs/removeDiacritics";
import { searchShow } from "./libs/tmdb";

const watcher = await createFileWatcher(parameters["input-directory"]);

watcher.on("ready", () => {
  logger.info("chiprr is ready");
});

async function handleFileCreated({ filePath }: { filePath: string }) {
  if (!isVideoFile(filePath)) return;

  const info: EpisodeInfo = await fuzzyMatch(filePath);

  await createHardLink(filePath, parameters["sorted-directory"], info!);
}

watcher.on("fileCreated", handleFileCreated);
