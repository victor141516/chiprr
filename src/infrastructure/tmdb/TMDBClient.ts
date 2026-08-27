import { Logger } from "../logging/Logger";
import { TMDBCache, type CachedMovie, type CachedShow } from "./TMDBCache";

type ShowSearchResult = {
  results: Array<{ id: number; name: string }>;
  total_results: number;
};

type MovieSearchResult = {
  results: Array<{
    id: number;
    title: string;
    original_title: string;
    release_date?: string;
  }>;
  total_results: number;
};

type ShowTranslationsResult = {
  translations: Array<{
    english_name: string;
    data: { name: string };
  }>;
};

type MovieTranslationsResult = {
  translations: Array<{
    iso_3166_1: string;
    iso_639_1: string;
    data: { title: string };
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
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const cached = this.cache.getSearch<CachedShow>("show", normalizedQuery);
    if (cached !== undefined) {
      return cached;
    }

    const url = new URL(
      "https://api.themoviedb.org/3/search/tv?include_adult=true&language=en-US&page=1",
    );
    url.searchParams.set("query", query);

    const searchResult = await this.fetchJson<ShowSearchResult>(url);
    this.logger.debug(
      `[TMDB] Show search API result: ${JSON.stringify(searchResult)}`,
    );

    const exactMatch = searchResult.results.find(
      ({ name }) => name.toLocaleLowerCase() === normalizedQuery,
    );

    let result: CachedShow[];
    if (exactMatch) {
      result = [
        { ...exactMatch, names: [exactMatch.name.toLocaleLowerCase()] },
      ];
    } else {
      result = await Promise.all(
        searchResult.results.map(async (show) => {
          const names = this.uniqueNormalizedNames([
            show.name,
            ...(await this.getShowLanguageVariations(show.id)),
          ]);
          return { ...show, names };
        }),
      );
    }

    this.cache.setSearch("show", normalizedQuery, result);
    return result;
  }

  async searchMovie(query: string, year?: number): Promise<CachedMovie[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const cached = this.cache.getSearch<CachedMovie>(
      "movie",
      normalizedQuery,
      year,
    );
    if (cached !== undefined) {
      return cached;
    }

    const url = new URL(
      "https://api.themoviedb.org/3/search/movie?include_adult=true&language=en-US&page=1",
    );
    url.searchParams.set("query", query);
    if (year !== undefined) {
      url.searchParams.set("year", String(year));
    }

    const searchResult = await this.fetchJson<MovieSearchResult>(url);
    this.logger.debug(
      `[TMDB] Movie search API result: ${JSON.stringify(searchResult)}`,
    );

    const result = await Promise.all(
      searchResult.results.map(async (movie): Promise<CachedMovie> => {
        const translations = await this.getMovieTranslations(movie.id);
        const englishTranslations = translations
          .filter(
            (translation) =>
              translation.iso_639_1 === "en" &&
              translation.data.title.trim() !== "",
          )
          .sort((left, right) => {
            const leftPriority = left.iso_3166_1 === "US" ? 0 : 1;
            const rightPriority = right.iso_3166_1 === "US" ? 0 : 1;
            return (
              leftPriority - rightPriority ||
              left.data.title.localeCompare(right.data.title)
            );
          });

        const canonicalTitle =
          englishTranslations[0]?.data.title.trim() ||
          movie.original_title.trim() ||
          movie.title.trim();

        return {
          id: movie.id,
          title: canonicalTitle,
          originalTitle: movie.original_title,
          year: this.releaseYear(movie.release_date),
          names: this.uniqueNormalizedNames([
            movie.title,
            movie.original_title,
            ...translations.map((translation) => translation.data.title),
          ]),
        };
      }),
    );

    this.cache.setSearch("movie", normalizedQuery, result, year);
    return result;
  }

  private async getShowLanguageVariations(showId: number): Promise<string[]> {
    const url = new URL(
      `https://api.themoviedb.org/3/tv/${showId}/translations`,
    );
    const result = await this.fetchJson<ShowTranslationsResult>(url);
    return result.translations
      .map((translation) => translation.data.name)
      .filter((name) => name.trim() !== "");
  }

  private async getMovieTranslations(
    movieId: number,
  ): Promise<MovieTranslationsResult["translations"]> {
    const url = new URL(
      `https://api.themoviedb.org/3/movie/${movieId}/translations`,
    );
    const result = await this.fetchJson<MovieTranslationsResult>(url);
    return result.translations;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `TMDB request failed (${response.status} ${response.statusText}): ${url.pathname}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private uniqueNormalizedNames(names: string[]): string[] {
    return [
      ...new Set(
        names
          .map((name) => name.trim().toLocaleLowerCase())
          .filter((name) => name !== ""),
      ),
    ];
  }

  private releaseYear(releaseDate?: string): number | null {
    const year = releaseDate?.match(/^(?<year>\d{4})/)?.groups?.year;
    return year ? Number.parseInt(year, 10) : null;
  }
}
