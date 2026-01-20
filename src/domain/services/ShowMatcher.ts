import { Logger } from "../../infrastructure/logging/Logger";
import { TMDBClient } from "../../infrastructure/tmdb/TMDBClient";
import { removeDiacritics } from "../../utils/stringUtils";
import type { EpisodeInfo } from "../models/EpisodeInfo";
import type { ParsedPathElement } from "./VideoFileParser";

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

  async match(parsedPathElements: ParsedPathElement[]): Promise<EpisodeInfo> {
    // Heuristic: Find the best element with episode info
    // Priority: 1) File element with episode info, 2) Any directory with episode info, 3) File element even without info
    const fileElement = parsedPathElements[parsedPathElements.length - 1];
    if (!fileElement) {
      throw new Error("No path elements provided");
    }

    // Find an element with valid episode/season info
    let episodeSource = fileElement;
    if (fileElement.episode === null || fileElement.season === null) {
      // Look for episode info in directories (from closest to furthest)
      for (let i = parsedPathElements.length - 2; i >= 0; i--) {
        const dir = parsedPathElements[i];
        if (dir && dir.episode !== null && dir.season !== null) {
          episodeSource = dir;
          this.logger.debug(
            `Using episode info from directory: ${dir.bestEffortShowName} (S${dir.season}E${dir.episode})`,
          );
          break;
        }
      }
    }

    // If we still don't have episode info, throw an error
    if (episodeSource.episode === null || episodeSource.season === null) {
      throw new Error(
        `Could not find episode/season information in any path element for: ${parsedPathElements.map((el) => el.bestEffortShowName).join("/")}`,
      );
    }

    const season = episodeSource.season;
    const episode = episodeSource.episode;

    // Try to match the file's show name first
    const { foundMatch, matchedName } = await this.tryMatch(
      fileElement.bestEffortShowName,
    );

    if (foundMatch) {
      return {
        showName: matchedName,
        season,
        episode,
      };
    }

    // If no exact match found with filename, try parent directories iteratively
    // Directories are in order from root to file, so we reverse to go from closest to furthest
    const directories = parsedPathElements
      .filter((el) => el.type === "directory")
      .reverse();

    if (directories.length > 0) {
      this.logger.debug(
        `No exact match found for filename "${
          fileElement.bestEffortShowName
        }". Trying parent directories iteratively. (${JSON.stringify(
          directories.map((d) => d.bestEffortShowName),
        )})`,
      );

      // Iterate from closest parent to furthest
      for (const directory of directories) {
        // Skip meaningless directory names
        if (directory.bestEffortShowName.length <= 3) {
          continue;
        }

        this.logger.debug(
          `Trying parent directory: "${directory.bestEffortShowName}"`,
        );
        const { foundMatch, matchedName } = await this.tryMatch(
          directory.bestEffortShowName,
        );

        if (foundMatch) {
          this.logger.debug(
            `Perfect match found with parent directory: "${directory.bestEffortShowName}" -> "${matchedName}"`,
          );
          return {
            showName: matchedName,
            season,
            episode,
          };
        }
      }

      this.logger.debug(
        "No exact match found in parent directories. Falling back to first result.",
      );
    }

    // Fallback to first result with original show name
    const searchResult = await this.tmdbClient.searchShow(
      fileElement.bestEffortShowName,
    );
    if (searchResult.length === 0) {
      this.logger.error(
        `Could not find any match for name: ${fileElement.bestEffortShowName}`,
      );
      throw new Error(
        `Could not find any match for name: ${fileElement.bestEffortShowName}`,
      );
    } else {
      this.logger.warn(
        `Could not find exact match for: "${
          fileElement.bestEffortShowName
        }". Using first search result: "${searchResult[0]!.name}"`,
      );
      return {
        showName: searchResult[0]!.name,
        season,
        episode,
      };
    }
  }

  private async tryMatch(
    name: string,
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
      `Not found exact match for "${name}". Trying without diacritics.`,
    );
    const parsedNameWithoutDiacritics = removeDiacritics(name.toLowerCase());
    for (const show of searchResult) {
      const apiNamesWithoutDiacritics = show.names.map((n) =>
        removeDiacritics(n),
      );
      if (apiNamesWithoutDiacritics.includes(parsedNameWithoutDiacritics)) {
        this.logger.debug(
          `Found a match after removing diacritics: "${parsedNameWithoutDiacritics}" in "${JSON.stringify(
            apiNamesWithoutDiacritics,
          )}"`,
        );
        return { foundMatch: true, matchedName: show.name };
      }
    }

    return { foundMatch: false, matchedName: "" };
  }
}
