import * as path from "path";
import { longestCommonSubstring } from "string-algorithms";
import { Logger } from "../../infrastructure/logging/Logger";
import type { EpisodeInfo } from "../models/EpisodeInfo";

/**
 * Here is the logic to "smartly" extract information from the file path and file name
 */
export class VideoFileParser {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  parse(filePath: string): EpisodeInfo & { parentDirectories: string[] } {
    const parsedPath = this.parsePath(filePath);
    const fileName = parsedPath.at(-1)!;

    const { matchedStrings, season, episode } =
      this.findEpisodeAndSeason(fileName);

    // Remove extension
    const initialCleanFilename = fileName
      .replace(/\.[a-zA-Z0-9]{2,10}$/, "")
      .trim();

    this.logger.debug({ initialCleanFilename });

    // Process FILENAME to remove garbage
    const fullyCleanFilename = this.cleanFileName(
      initialCleanFilename,
      matchedStrings
    );
    this.logger.debug(`Fully clean filename: "${fullyCleanFilename}"`);
    let showName: string;

    // Extract and clean parent directories for matching
    const parentDirectories: string[] = [];
    if (parsedPath.length > 1) {
      // Get directories from closest to furthest (reverse order)
      for (let i = parsedPath.length - 2; i >= 0; i--) {
        const directory = parsedPath[i]!;
        const fullyCleanDir = this.cleanFileName(directory, matchedStrings);
        if (fullyCleanDir.length > 3) {
          // Only add meaningful directory names
          parentDirectories.push(fullyCleanDir);
        }
      }
    }

    if (parsedPath.length === 1) {
      this.logger.debug(
        "There are NOT directories in the path --> choosing the file name version"
      );
      showName = fullyCleanFilename;
    } else {
      this.logger.debug(
        "There are directories in the path --> trying candidates"
      );
      let candidates: string[] = [];
      // Traverse directories and try to find a good match
      for (const directory of parsedPath.slice(0, -1)) {
        // Process DIRECTORY to remove garbage
        const fullyCleanDir = this.cleanFileName(directory, matchedStrings);
        this.logger.debug(`Fully clean dir: "${fullyCleanDir}"`);

        // If one directory completely matches the show name extracted from the filename, then it's surely the good one
        if (fullyCleanDir.includes(fullyCleanFilename)) {
          this.logger.debug("Perfect match");
          candidates = longestCommonSubstring([
            fullyCleanDir,
            fullyCleanFilename,
          ]);
          break;
        } else {
          // If there is no full intersection, check partial intersections
          const commonSubstrings = longestCommonSubstring([
            fullyCleanDir,
            fullyCleanFilename,
          ]);

          if (commonSubstrings.length > 0) {
            const partialMatch = commonSubstrings[0]!;
            this.logger.debug(`Partial match found: ${partialMatch}`);
            candidates.push(partialMatch);
          } else {
            this.logger.debug(
              `No match at all: "${fullyCleanDir}" vs "${fullyCleanFilename}"`
            );
          }
        }
      }

      this.logger.debug({ candidates });
      if (candidates.length > 0) {
        const longerCandidate = candidates.sort(
          (a, b) => b.length - a.length
        )[0]!;
        this.logger.debug({ longerCandidate });
        if (longerCandidate.length > 3) {
          this.logger.debug("Using partial match");
          showName = longerCandidate;
        } else {
          showName = fullyCleanFilename;
        }
      } else {
        this.logger.debug(
          "No candidates found --> falling back to filename version"
        );
        this.logger.warn(`Not sure about this one: fileName: "${fileName}"`);
        showName = fullyCleanFilename;
      }
    }

    showName = this.trimGarbage(showName);

    return {
      showName,
      season,
      episode,
      parentDirectories,
    };
  }

  private parsePath(inputPath: string): string[] {
    const parts: string[] = [];
    let currentPath = inputPath;

    currentPath = path.normalize(currentPath);

    do {
      const parsed = path.parse(currentPath);

      if (parsed.base && parsed.base !== ".") {
        parts.unshift(parsed.base);
      }

      currentPath = parsed.dir;
    } while (currentPath && currentPath !== path.parse(currentPath).root);

    return parts;
  }

  private cleanFileName(
    fileName: string,
    episodeMatchedTexts: string[]
  ): string {
    let showName = fileName;

    for (const episodeMatchedText of episodeMatchedTexts) {
      const episodeIndicatorPosition = fileName.indexOf(episodeMatchedText);
      this.logger.debug(
        `Trying to remove "${episodeMatchedText}" from file name "${fileName}". Found at position: ${episodeIndicatorPosition}`
      );
      if (episodeIndicatorPosition > 4) {
        showName = fileName
          .slice(0, episodeIndicatorPosition)
          .replace(/[\(\[\<]$/g, "");
        this.logger.debug(
          `Cleaning file name. Step 1. showName: "${showName}"`
        );
      }
    }

    // Remove everything in brackets
    showName = showName
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\([^\]]*\)/g, "")
      .replace(/\{[^\]]*\}/g, "")
      .replace(/\<[^\]]*\>/g, "");
    this.logger.debug(`Cleaning file name. Step 2. showName: "${showName}"`);

    // In case something forgets a whitespace before/after a dash
    showName = showName.replace(/(\w)\s+-\s+(\w)/g, "$1 - $2");
    this.logger.debug(`Cleaning file name. Step 3. showName: "${showName}"`);

    const periods = (fileName.match(/\./g) || []).length;
    if (periods / fileName.length > 0.07) {
      this.logger.debug("Removing periods");
      showName = showName.replace(/\./g, " ");
    }
    this.logger.debug(`Cleaning file name. Step 4. showName: "${showName}"`);

    const underscores = (fileName.match(/\_/g) || []).length;
    if (underscores / fileName.length > 0.07) {
      this.logger.debug("Removing underscores");
      showName = showName.replace(/\_/g, " ");
    }
    this.logger.debug(`Cleaning file name. Step 5. showName: "${showName}"`);

    showName = showName.replace(
      /\b(?:HDTV|720p|1080p|480p|WEB-DL|BluRay|DVDRip|x264|x265|HEVC|AAC|AC3)\b/gi,
      ""
    );
    this.logger.debug(`Cleaning file name. Step 6. showName: "${showName}"`);

    showName = showName.replace(/\s+/g, " ").trim();
    this.logger.debug(`Cleaning file name. Step 7. showName: "${showName}"`);

    if (showName.includes(" - ")) {
      const maybeShowName = showName.split(" - ")[0]!;
      if (maybeShowName.match(/^(?:[^\s]\s?)+$/)) {
        showName = maybeShowName;
      }
    }
    this.logger.debug(`Cleaning file name. Step 8. showName: "${showName}"`);

    showName = showName.toLowerCase();
    this.logger.debug(`Cleaning file name. Step 9. showName: "${showName}"`);

    return showName;
  }

  private trimGarbage(fileName: string): string {
    let input = fileName;
    let result = "";

    while (result !== input) {
      input = result || fileName;
      result = input
        .trim()
        .replace(/^[\-\.]/g, "")
        .replace(/[\-\.]$/g, "")
        .trim();
    }

    return result;
  }

  private findEpisodeAndSeason(fileName: string): {
    matchedStrings: string[];
    season: number;
    episode: number;
  } {
    const patterns = [
      // S01E01, S1E1, etc.
      /[Ss](?<season>\d{1,2})[Ee](?<episode>\d{1,3})/,
      // 1x01, 01x01, etc.
      /(?<season>\d{1,2})x(?<episode>\d{1,3})/i,
      // Cap.101, Cap101, Capitulo.101, etc.
      /(?:cap(?:itulo)?\.?\s*)(?<season>\d{1,2})(?<episode>\d{2})/i,
      /(?:cap(?:itulo)?\.?\s*)(?<episode>\d{1,2})/i,
      // E01, Ep01, etc.
      /(?:e|ep|episode)\.?\s*(?<episode>\d{1,3})/i,
      // One Punch Man S03 - E01 [Sub] 1080p.mkv
      /(?:s)(?<season>\d{1,2})/i,
    ];

    const matchedStrings: string[] = [];
    let season: number | undefined;
    let episode: number | undefined;

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        this.logger.debug(`Regex match: ${JSON.stringify(match)}`);
        if (match[0]) {
          matchedStrings.push(match[0]);
        }

        if (match.groups?.season) {
          season = Number.parseInt(match.groups.season);
        }

        if (match.groups?.episode) {
          episode = Number.parseInt(match.groups.episode);
        }

        if (season && episode) {
          break;
        }
      }
    }

    if (!season || !episode) {
      throw new Error(
        "Could not find season/episode information in file name: " + fileName
      );
    }

    return {
      matchedStrings,
      season,
      episode,
    };
  }
}
