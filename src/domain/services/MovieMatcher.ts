import type { MovieInfo } from "../models/MovieInfo";
import type { CachedMovie } from "../../infrastructure/tmdb/TMDBCache";
import { Logger } from "../../infrastructure/logging/Logger";
import { removeDiacritics } from "../../utils/stringUtils";
import type { MovieCandidate } from "./MovieFileParser";

export interface MovieSearchClient {
  searchMovie(query: string, year?: number): Promise<CachedMovie[]>;
}

export class MovieMatcher {
  private tmdbClient: MovieSearchClient;
  private logger: Logger;

  constructor({
    tmdbClient,
    logger,
  }: {
    tmdbClient: MovieSearchClient;
    logger: Logger;
  }) {
    this.tmdbClient = tmdbClient;
    this.logger = logger;
  }

  async match(candidates: MovieCandidate[]): Promise<MovieInfo> {
    if (candidates.length === 0) {
      throw new Error("Could not extract a movie title from the path");
    }

    const attemptedCandidates: string[] = [];
    let fallback: { movie: CachedMovie; candidate: MovieCandidate } | undefined;
    let ambiguousCandidate: MovieCandidate | undefined;

    for (const candidate of candidates) {
      attemptedCandidates.push(
        `${candidate.title}${candidate.year ? ` (${candidate.year})` : ""}`,
      );
      const searchResult = await this.tmdbClient.searchMovie(
        candidate.title,
        candidate.year ?? undefined,
      );

      if (!fallback && searchResult[0]) {
        fallback = { movie: searchResult[0], candidate };
      }

      const normalizedCandidate = this.normalize(candidate.title);
      const exactTitleMatches = searchResult.filter((movie) =>
        movie.names.some(
          (movieName) => this.normalize(movieName) === normalizedCandidate,
        ),
      );

      if (candidate.year !== null) {
        const titleAndYearMatches = exactTitleMatches.filter(
          (movie) => movie.year === candidate.year,
        );
        if (titleAndYearMatches.length === 1) {
          return this.toMovieInfo(titleAndYearMatches[0]!);
        }
        if (titleAndYearMatches.length > 1) {
          ambiguousCandidate = candidate;
          continue;
        }

        const unknownYearMatches = exactTitleMatches.filter(
          (movie) => movie.year === null,
        );
        if (exactTitleMatches.length === 1 && unknownYearMatches.length === 1) {
          return this.toMovieInfo(unknownYearMatches[0]!);
        }

        if (exactTitleMatches.length > 0) {
          ambiguousCandidate = candidate;
        }
        continue;
      }

      if (exactTitleMatches.length === 1) {
        return this.toMovieInfo(exactTitleMatches[0]!);
      }

      if (exactTitleMatches.length > 1) {
        ambiguousCandidate = candidate;
      }
    }

    if (ambiguousCandidate) {
      const attempted = attemptedCandidates.join(", ");
      const message = `Ambiguous TMDB movie match for "${ambiguousCandidate.sourceName}". Attempted candidates: ${attempted}`;
      this.logger.error(message);
      throw new Error(message);
    }

    if (fallback) {
      this.logger.warn(
        `No exact TMDB movie match for "${fallback.candidate.sourceName}". Using first result: "${fallback.movie.title}"${fallback.movie.year ? ` (${fallback.movie.year})` : ""}. Attempted candidates: ${attemptedCandidates.join(", ")}`,
      );
      return this.toMovieInfo(fallback.movie);
    }

    const message = `Could not find a TMDB movie match. Attempted candidates: ${attemptedCandidates.join(", ")}`;
    this.logger.error(message);
    throw new Error(message);
  }

  private normalize(value: string): string {
    return removeDiacritics(value.trim().toLocaleLowerCase()).replace(
      /\s+/g,
      " ",
    );
  }

  private toMovieInfo(movie: CachedMovie): MovieInfo {
    return {
      kind: "movie",
      title: movie.title,
      year: movie.year,
    };
  }
}
