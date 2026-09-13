import { Logger } from "../../infrastructure/logging/Logger";
import type { CachedShow } from "../../infrastructure/tmdb/TMDBCache";
import type { EpisodeInfo } from "../models/EpisodeInfo";
import type { ParsedPathElement } from "./VideoFileParser";
import { groupCorroboratedTitles } from "./MediaPathEvidence";
import { matchTitleVariants } from "./TitleMatchPipeline";

export interface ShowSearchClient {
  searchShow(query: string): Promise<CachedShow[]>;
  getShowEvidence?(showId: number): Promise<string[]>;
}

/**
 * Takes information extracted exclusively from the file name (or directories in the file path)
 * and look into a database to match the extracted name to a an actual show.
 */
export class ShowMatcher {
  private tmdbClient: ShowSearchClient;
  private logger: Logger;

  constructor({
    tmdbClient,
    logger,
  }: {
    tmdbClient: ShowSearchClient;
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

    // Directories are in order from root to file, so reverse them to collect
    // common title evidence from the closest parent first.
    const directories = parsedPathElements
      .filter((el) => el.type === "directory")
      .reverse()
      .filter(({ bestEffortShowName }) => bestEffortShowName.length > 3);
    const titleGroups = groupCorroboratedTitles(
      [fileElement, ...directories],
      ({ bestEffortShowName }) => bestEffortShowName,
    );
    let fallback: CachedShow | undefined;

    for (const group of titleGroups) {
      const titles = group.items.map(({ bestEffortShowName }) =>
        bestEffortShowName,
      );
      const title = titles[0]!;
      this.logger.debug(
        `Trying show title evidence "${title}" with ${group.support} supporting path element(s)`,
      );
      const result = await matchTitleVariants({
        title: titles,
        search: (query) => this.tmdbClient.searchShow(query),
        loadEvidence: this.tmdbClient.getShowEvidence
          ? (show) => this.tmdbClient.getShowEvidence!(show.id)
          : undefined,
      });
      fallback ??= result.fallback;
      if (result.match) {
        return {
          kind: "show",
          showName: result.match.name,
          season,
          episode,
        };
      }
    }

    if (fallback) {
      this.logger.warn(
        `Could not find an exact corroborated show title. Using first result: "${fallback.name}"`,
      );
      return {
        kind: "show",
        showName: fallback.name,
        season,
        episode,
      };
    }

    const attempted = titleGroups
      .map(({ items }) => items[0]!.bestEffortShowName)
      .join(", ");
    this.logger.error(`Could not find any show match. Attempted: ${attempted}`);
    throw new Error(`Could not find any show match. Attempted: ${attempted}`);
  }
}
