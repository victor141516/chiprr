import { Logger } from "../logging/Logger";
import { TMDBCache, type CachedMovie, type CachedShow } from "./TMDBCache";

type ShowSearchResult = {
  results: Array<{ id: number; name: string; original_name?: string }>;
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

type ProductionCompany = {
  name: string;
  origin_country?: string;
};

type ProductionCountry = {
  iso_3166_1: string;
  name: string;
};

type SpokenLanguage = {
  iso_639_1?: string;
  english_name?: string;
  name?: string;
};

type MovieEvidenceResult = {
  title?: string;
  original_title?: string;
  release_date?: string;
  original_language?: string;
  production_companies?: ProductionCompany[];
  production_countries?: ProductionCountry[];
  spoken_languages?: SpokenLanguage[];
  credits?: {
    cast?: Array<{ name: string }>;
    crew?: Array<{ name: string; job?: string; department?: string }>;
  };
};

type ShowEvidenceResult = {
  name?: string;
  original_name?: string;
  first_air_date?: string;
  original_language?: string;
  origin_country?: string[];
  created_by?: Array<{ name: string }>;
  networks?: Array<{ name: string; origin_country?: string }>;
  production_companies?: ProductionCompany[];
  production_countries?: ProductionCountry[];
  spoken_languages?: SpokenLanguage[];
};

export class TMDBClient {
  private cache: TMDBCache;
  private apiToken: string;
  private baseUrl: string;
  private logger: Logger;
  private evidenceCache = new Map<string, string[]>();

  constructor({
    apiToken,
    baseUrl = "https://api.themoviedb.org/3",
    cache,
    logger,
  }: {
    apiToken: string;
    baseUrl?: string;
    cache: TMDBCache;
    logger: Logger;
  }) {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.logger = logger;
    this.cache = cache;
  }

  async searchShow(query: string): Promise<CachedShow[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const cached = this.cache.getSearch<CachedShow>("show", normalizedQuery);
    if (cached !== undefined) {
      return cached;
    }
    if (!this.apiToken) {
      return [];
    }

    const url = new URL(
      `${this.baseUrl}/search/tv?include_adult=true&language=en-US&page=1`,
    );
    url.searchParams.set("query", query);

    const searchResult = await this.fetchJson<ShowSearchResult>(url);
    this.logger.debug(
      `[TMDB] Show search API result: ${JSON.stringify(searchResult)}`,
    );

    const exactMatches = searchResult.results.filter(
      ({ name, original_name }) =>
        name.toLocaleLowerCase() === normalizedQuery ||
        original_name?.toLocaleLowerCase() === normalizedQuery,
    );

    let result: CachedShow[];
    if (exactMatches.length > 0) {
      result = exactMatches.map((show) => ({
        id: show.id,
        name: show.name,
        names: this.uniqueNormalizedNames([
          show.name,
          show.original_name || "",
        ]),
      }));
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
    if (!this.apiToken) {
      return [];
    }

    const url = new URL(
      `${this.baseUrl}/search/movie?include_adult=true&language=en-US&page=1`,
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

  async getMovieEvidence(movieId: number): Promise<string[]> {
    const cacheKey = `movie:${movieId}`;
    const cached = this.evidenceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(`${this.baseUrl}/movie/${movieId}`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", "credits");
    const movie = await this.fetchJson<MovieEvidenceResult>(url);
    const evidence = this.uniqueEvidence([
      movie.title,
      movie.original_title,
      movie.release_date?.match(/^\d{4}/)?.[0],
      movie.original_language,
      ...this.companyEvidence(movie.production_companies),
      ...this.countryEvidence(movie.production_countries),
      ...this.languageEvidence(movie.spoken_languages),
      ...(movie.credits?.cast || []).map(({ name }) => name),
      ...(movie.credits?.crew || [])
        .filter(
          ({ job, department }) =>
            job === "Director" || department === "Directing",
        )
        .map(({ name }) => name),
    ]);
    this.evidenceCache.set(cacheKey, evidence);
    return evidence;
  }

  async getShowEvidence(showId: number): Promise<string[]> {
    const cacheKey = `show:${showId}`;
    const cached = this.evidenceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(`${this.baseUrl}/tv/${showId}`);
    url.searchParams.set("language", "en-US");
    const show = await this.fetchJson<ShowEvidenceResult>(url);
    const evidence = this.uniqueEvidence([
      show.name,
      show.original_name,
      show.first_air_date?.match(/^\d{4}/)?.[0],
      show.original_language,
      ...(show.origin_country || []),
      ...(show.created_by || []).map(({ name }) => name),
      ...(show.networks || []).flatMap(({ name, origin_country }) => [
        name,
        origin_country,
      ]),
      ...this.companyEvidence(show.production_companies),
      ...this.countryEvidence(show.production_countries),
      ...this.languageEvidence(show.spoken_languages),
    ]);
    this.evidenceCache.set(cacheKey, evidence);
    return evidence;
  }

  private async getShowLanguageVariations(showId: number): Promise<string[]> {
    const url = new URL(
      `${this.baseUrl}/tv/${showId}/translations`,
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
      `${this.baseUrl}/movie/${movieId}/translations`,
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
        `TMDB request failed (${response.status} ${response.statusText}): ${url.href}`,
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

  private uniqueEvidence(values: Array<string | undefined>): string[] {
    return [
      ...new Set(values.map((value) => value?.trim()).filter(Boolean)),
    ] as string[];
  }

  private companyEvidence(
    companies: ProductionCompany[] = [],
  ): Array<string | undefined> {
    return companies.flatMap(({ name, origin_country }) => [
      name,
      origin_country,
    ]);
  }

  private countryEvidence(countries: ProductionCountry[] = []): string[] {
    return countries.flatMap(({ iso_3166_1, name }) => [iso_3166_1, name]);
  }

  private languageEvidence(
    languages: SpokenLanguage[] = [],
  ): Array<string | undefined> {
    return languages.flatMap(({ iso_639_1, english_name, name }) => [
      iso_639_1,
      english_name,
      name,
    ]);
  }

  private releaseYear(releaseDate?: string): number | null {
    const year = releaseDate?.match(/^(?<year>\d{4})/)?.groups?.year;
    return year ? Number.parseInt(year, 10) : null;
  }
}
