import { parameters } from "./libs/args";
import { createHardLink } from "./libs/createHardLink";
import { createFileWatcher } from "./libs/fileWatcher";
import { isVideoFile } from "./libs/filterVideoFiles";
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

  let foundMatch = false;
  for (const show of searchResult) {
    if (show.names.includes(info!.showName.toLowerCase())) {
      info.showName = show.name;
      foundMatch = true;
    }
  }

  if (foundMatch) {
    logger.debug(`Exact match found for: "${info!.showName}"`);
  }

  if (!foundMatch) {
    logger.debug(
      `Not found exact match for "${
        info!.showName
      }". Trying without diacritics.`
    );
    const parsedNameWithoutDiacritics = removeDiacritics(
      info!.showName.toLowerCase()
    );
    for (const show of searchResult) {
      const apiNamesWithoutDiacritics = show.names.map((e) =>
        removeDiacritics(e)
      );
      if (apiNamesWithoutDiacritics.includes(parsedNameWithoutDiacritics)) {
        info.showName = show.name;
        foundMatch = true;
        logger.debug(
          `Found a match after removing diacritics: "${parsedNameWithoutDiacritics}" in "${JSON.stringify(
            apiNamesWithoutDiacritics
          )}"`
        );
      }
    }

    if (foundMatch) {
      logger.debug(
        `Exact match (after removing diacritics) found for: ${info!.showName}`
      );
    }
  }

  if (!foundMatch) {
    if (searchResult.length === 0) {
      logger.warn("Could not found any match for name:", info!.showName);
    } else {
      logger.warn(
        `Could not find exact match for: "${
          info!.showName
        }" . Using first search result: "${searchResult[0]!.name}`
      );
      info.showName = searchResult[0]!.name;
    }
  }

  await createHardLink(filePath, parameters["sorted-directory"], info!);
}

watcher.on("fileCreated", handleFileCreated);
