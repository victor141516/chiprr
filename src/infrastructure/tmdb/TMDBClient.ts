import { Logger } from "../logging/Logger";
import { TMDBCache, type CachedShow } from "./TMDBCache";

type SearchResult = {
  results: Array<{
    id: number;
    name: string;
  }>;
  total_results: number;
};

type LanguageVariationsResult = {
  translations: Array<{
    english_name: string;
    data: {
      name: string;
    };
  }>;
};

export class TMDBClient {
  private cache: TMDBCache;
  private apiToken: string;
  private logger: Logger;

  constructor({
    apiToken,
    cache,
    logger,
  }: {
    apiToken: string;
    cache: TMDBCache;
    logger: Logger;
  }) {
    this.apiToken = apiToken;
    this.logger = logger;
    this.cache = cache;
  }

  async searchShow(query: string): Promise<CachedShow[]> {
    if (this.cache.has(query)) {
      return this.cache.get(query)!;
    }

    const url = new URL(
      "https://api.themoviedb.org/3/search/tv?include_adult=true&language=en-US&page=1",
    );
    url.searchParams.set("query", query);

    const searchResult = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiToken}`,
      },
    }).then((res) => res.json() as Promise<SearchResult>);

    this.logger.debug(
      `[TMDB] Search API result: ${JSON.stringify(searchResult)}`,
    );

    const exactMatch = searchResult.results.find(({ name }) => {
      return name.toLowerCase() === query.toLowerCase();
    });

    let result: CachedShow[];

    if (exactMatch) {
      this.logger.debug(
        `[TMDB] Exact match found: ${JSON.stringify(exactMatch)}`,
      );
      result = [{ ...exactMatch, names: [exactMatch.name.toLowerCase()] }];
    } else {
      this.logger.debug(
        `[TMDB] Exact match NOT found. Trying language variations`,
      );
      result = await Promise.all(
        searchResult.results.map(async (show) => {
          const names = [
            show.name,
            ...(await this.getLanguageVariations(show.id)),
          ].map((name) => name.toLowerCase());
          return { ...show, names };
        }),
      );
      this.logger.debug(
        `[TMDB] Language variations found: ${JSON.stringify(result)}`,
      );
    }

    this.cache.set(query, result);

    return result;
  }

  private async getLanguageVariations(showId: number): Promise<string[]> {
    const url = new URL(
      `https://api.themoviedb.org/3/tv/${showId}/translations`,
    );

    const result = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiToken}`,
      },
    }).then((res) => res.json() as Promise<LanguageVariationsResult>);

    return result.translations
      .map((t) => t.data.name)
      .filter((name) => name !== "");
  }
}
