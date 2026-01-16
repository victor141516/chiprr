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

  async match(
    episodeInfo: EpisodeInfo,
    parentDirectories?: string[]
  ): Promise<EpisodeInfo> {
    const { foundMatch, matchedName } = await this.tryMatch(
      episodeInfo.showName
    );

    if (foundMatch) {
      episodeInfo.showName = matchedName;
      return episodeInfo;
    }

    // If no exact match found with filename, try parent directories iteratively
    if (parentDirectories && parentDirectories.length > 0) {
      this.logger.debug(
        `No exact match found for filename "${
          episodeInfo.showName
        }". Trying parent directories iteratively. (${JSON.stringify(
          parentDirectories
        )})`
      );

      // Iterate from closest parent to furthest
      for (const directory of parentDirectories) {
        this.logger.debug(`Trying parent directory: "${directory}"`);
        const { foundMatch, matchedName } = await this.tryMatch(directory);

        if (foundMatch) {
          this.logger.debug(
            `Perfect match found with parent directory: "${directory}" -> "${matchedName}"`
          );
          episodeInfo.showName = matchedName;
          return episodeInfo;
        }
      }

      this.logger.debug(
        "No exact match found in parent directories. Falling back to first result."
      );
    }

    // Fallback to first result with original show name
    const searchResult = await this.tmdbClient.searchShow(episodeInfo.showName);
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

  private async tryMatch(
    name: string
  ): Promise<{ foundMatch: boolean; matchedName: string }> {
    const searchResult = await this.tmdbClient.searchShow(name);

    // Try exact match
    for (const show of searchResult) {
      if (show.names.includes(name.toLowerCase())) {
        this.logger.debug(`Exact match found for: "${name}"`);
        return { foundMatch: true, matchedName: show.name };
      }
    }

    // Try without diacritics
    this.logger.debug(
      `Not found exact match for "${name}". Trying without diacritics.`
    );
    const parsedNameWithoutDiacritics = removeDiacritics(name.toLowerCase());
    for (const show of searchResult) {
      const apiNamesWithoutDiacritics = show.names.map((n) =>
        removeDiacritics(n)
      );
      if (apiNamesWithoutDiacritics.includes(parsedNameWithoutDiacritics)) {
        this.logger.debug(
          `Found a match after removing diacritics: "${parsedNameWithoutDiacritics}" in "${JSON.stringify(
            apiNamesWithoutDiacritics
          )}"`
        );
        return { foundMatch: true, matchedName: show.name };
      }
    }

    return { foundMatch: false, matchedName: "" };
  }
}
