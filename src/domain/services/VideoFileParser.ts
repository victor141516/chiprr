import * as path from "path";
import { Logger } from "../../infrastructure/logging/Logger";

export interface ParsedPathElement {
  episode: number | null;
  season: number | null;
  bestEffortShowName: string;
  type: "directory" | "file";
}

/**
 * Here is the logic to "smartly" extract information from the file path and file name
 */
export class VideoFileParser {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  parse(filePath: string): ParsedPathElement[] {
    const parsedPath = this.parsePath(filePath);
    const result: ParsedPathElement[] = [];

    // Process each path element independently
    for (let i = 0; i < parsedPath.length; i++) {
      const part = parsedPath[i]!;
      const isFile = i === parsedPath.length - 1;

      // Clean the name (remove extension for files)
      let cleanName = part;
      if (isFile) {
        cleanName = part.replace(/\.[a-zA-Z0-9]{2,10}$/, "").trim();
      }

      // Try to extract episode info from this element
      let elementSeason: number | null = null;
      let elementEpisode: number | null = null;
      let elementMatchedStrings: string[] = [];

      const episodeInfo = this.tryFindEpisodeAndSeason(part);
      if (episodeInfo) {
        elementSeason = episodeInfo.season;
        elementEpisode = episodeInfo.episode;
        elementMatchedStrings = episodeInfo.matchedStrings;
      }

      // Clean the name to get the best effort show name
      const fullyCleanName = this.cleanFileName(
        cleanName,
        elementMatchedStrings,
      );
      const bestEffortShowName = this.trimGarbage(fullyCleanName);

      result.push({
        episode: elementEpisode,
        season: elementSeason,
        bestEffortShowName,
        type: isFile ? "file" : "directory",
      });
    }

    return result;
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
    episodeMatchedTexts: string[],
  ): string {
    let showName = fileName;

    for (const episodeMatchedText of episodeMatchedTexts) {
      const episodeIndicatorPosition = fileName.indexOf(episodeMatchedText);
      this.logger.debug(
        `Trying to remove "${episodeMatchedText}" from file name "${fileName}". Found at position: ${episodeIndicatorPosition}`,
      );
      if (episodeIndicatorPosition > 4) {
        showName = fileName
          .slice(0, episodeIndicatorPosition)
          .replace(/[\(\[\<]$/g, "");
        this.logger.debug(
          `Cleaning file name. Step 1. showName: "${showName}"`,
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
      "",
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

  /**
   * Try to find episode and season information, returns null if not found
   */
  private tryFindEpisodeAndSeason(fileName: string): {
    matchedStrings: string[];
    season: number;
    episode: number;
  } | null {
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
      return null;
    }

    return {
      matchedStrings,
      season,
      episode,
    };
  }
}
