import { parameters } from "./libs/args";
import { createHardLink } from "./libs/createHardLink";
import { createFileWatcher } from "./libs/fileWatcher";
import { isVideoFile } from "./libs/filterVideoFiles";
import { logger } from "./libs/logger";
import {
  parseVideoFileName,
  type EpisodeInfo,
} from "./libs/parseVideoFileName/parseVideoFileName";
import { searchShow } from "./libs/tmdb";

const watcher = await createFileWatcher(parameters["input-directory"]);

async function handleFileCreated({ filePath }: { filePath: string }) {
  if (!isVideoFile(filePath)) return;

  let info: EpisodeInfo | null = null;
  try {
    info = parseVideoFileName(filePath);
  } catch (error) {
    logger.error(error);
    return;
  }

  const searchResult = await searchShow(
    info!.showName,
    parameters["tmdb-token"]
  );

  let foundMarch = false;
  for (const show of searchResult) {
    if (show.names.includes(info!.showName.toLowerCase())) {
      info.showName = show.name;
      foundMarch = true;
    }
  }

  if (foundMarch) {
    logger.debug("Exact match found for:", info!.showName);
  }

  if (!foundMarch) {
    if (searchResult.length === 0) {
      logger.warn("Could not found any match for name:", info!.showName);
    } else {
      logger.warn(
        'Could not find exact match for: "',
        info!.showName,
        '" . Using first search result: "',
        searchResult[0]!.name,
        '"'
      );
      info.showName = searchResult[0]!.name;
    }
  }

  await createHardLink(filePath, parameters["sorted-directory"], info!);
}

watcher.on("fileCreated", handleFileCreated);
