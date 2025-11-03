import { parameters } from "./args";
import { logger } from "./logger";
import {
  parseVideoFileName,
  type EpisodeInfo,
} from "./parseVideoFileName/parseVideoFileName";
import { removeDiacritics } from "./removeDiacritics";
import { searchShow } from "./tmdb";

export async function fuzzyMatch(filePath: string) {
  let info: EpisodeInfo;
  try {
    info = parseVideoFileName(filePath);
  } catch (error) {
    logger.error(error);
    return;
  }

  const searchResult = await searchShow(
    info.showName,
    parameters["tmdb-token"]
  );

  let foundMatch = false;

  for (const show of searchResult) {
    if (show.names.includes(info.showName.toLowerCase())) {
      info.showName = show.name;
      foundMatch = true;
    }
  }

  if (foundMatch) {
    logger.debug(`Exact match found for: "${info.showName}"`);
  }

  if (!foundMatch) {
    logger.debug(
      `Not found exact match for "${info.showName}". Trying without diacritics.`
    );
    const parsedNameWithoutDiacritics = removeDiacritics(
      info.showName.toLowerCase()
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
        `Exact match (after removing diacritics) found for: ${info.showName}`
      );
    }
  }

  if (!foundMatch) {
    if (searchResult.length === 0) {
      logger.error(`Could not found any match for name: ${info.showName}`);
      throw new Error(`Could not found any match for name: ${info.showName}`);
    } else {
      logger.warn(
        `Could not find exact match for: "${
          info.showName
        }" . Using first search result: "${searchResult[0]!.name}`
      );
      info.showName = searchResult[0]!.name;
    }
  }

  return info;
}
