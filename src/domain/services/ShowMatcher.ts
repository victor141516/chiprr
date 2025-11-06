import { Logger } from "../../infrastructure/logging/Logger";
import { TMDBClient } from "../../infrastructure/tmdb/TMDBClient";
import { removeDiacritics } from "../../utils/stringUtils";
import type { EpisodeInfo } from "../models/EpisodeInfo";

/**
 * Takes information extracted exclusively from the file name (or directories in the file path)
 * and look into a database to match the extracted name to a an actual show.
 */
export class ShowMatcher {
  private tmdbClient: TMDBClient;
  private logger: Logger;

  constructor({
    tmdbClient,
    logger,
  }: {
    tmdbClient: TMDBClient;
    logger: Logger;
  }) {
    this.tmdbClient = tmdbClient;
    this.logger = logger;
  }

  async match(episodeInfo: EpisodeInfo): Promise<EpisodeInfo> {
    const searchResult = await this.tmdbClient.searchShow(episodeInfo.showName);

    let foundMatch = false;

    for (const show of searchResult) {
      if (show.names.includes(episodeInfo.showName.toLowerCase())) {
        episodeInfo.showName = show.name;
        foundMatch = true;
      }
    }

    if (foundMatch) {
      this.logger.debug(`Exact match found for: "${episodeInfo.showName}"`);
      return episodeInfo;
    }

    // Try without diacritics
    this.logger.debug(
      `Not found exact match for "${episodeInfo.showName}". Trying without diacritics.`
    );
    const parsedNameWithoutDiacritics = removeDiacritics(
      episodeInfo.showName.toLowerCase()
    );
    for (const show of searchResult) {
      const apiNamesWithoutDiacritics = show.names.map((name) =>
        removeDiacritics(name)
      );
      if (apiNamesWithoutDiacritics.includes(parsedNameWithoutDiacritics)) {
        episodeInfo.showName = show.name;
        foundMatch = true;
        this.logger.debug(
          `Found a match after removing diacritics: "${parsedNameWithoutDiacritics}" in "${JSON.stringify(
            apiNamesWithoutDiacritics
          )}"`
        );
      }
    }

    if (foundMatch) {
      this.logger.debug(
        `Exact match (after removing diacritics) found for: ${episodeInfo.showName}`
      );
      return episodeInfo;
    }

    // Fallback to first result
    if (searchResult.length === 0) {
      this.logger.error(
        `Could not find any match for name: ${episodeInfo.showName}`
      );
      throw new Error(
        `Could not find any match for name: ${episodeInfo.showName}`
      );
    } else {
      this.logger.warn(
        `Could not find exact match for: "${
          episodeInfo.showName
        }". Using first search result: "${searchResult[0]!.name}"`
      );
      episodeInfo.showName = searchResult[0]!.name;
    }

    return episodeInfo;
  }
}
