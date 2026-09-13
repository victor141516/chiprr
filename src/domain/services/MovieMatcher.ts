import type { MovieInfo } from "../models/MovieInfo";
import type { CachedMovie } from "../../infrastructure/tmdb/TMDBCache";
import { Logger } from "../../infrastructure/logging/Logger";
import type { MovieCandidate } from "./MovieFileParser";
import { groupCorroboratedTitles } from "./MediaPathEvidence";
import { matchTitleVariants } from "./TitleMatchPipeline";

export interface MovieSearchClient {
  searchMovie(query: string, year?: number): Promise<CachedMovie[]>;
  getMovieEvidence?(movieId: number): Promise<string[]>;
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

    const candidateGroups = groupCorroboratedTitles(
      candidates,
      ({ title }) => title,
    );

    for (const group of candidateGroups) {
      const candidate = group.items[0]!;
      for (const item of group.items) {
        const attempted = `${item.title}${item.year ? ` (${item.year})` : ""}`;
        if (!attemptedCandidates.includes(attempted)) {
          attemptedCandidates.push(attempted);
        }
      }

      // A four-digit token can be part of the title (for example, "Odisea
      // 2001") rather than a release year. Try that complete title first and
      // only treat the token as a year later if the base title is ambiguous.
      const titlesWithYearToken = [
        ...new Set(
          group.items
            .map(({ titleWithYearToken }) => titleWithYearToken)
            .filter((title): title is string => Boolean(title)),
        ),
      ];
      for (const titleWithYearToken of titlesWithYearToken) {
        const result = await matchTitleVariants({
          title: titleWithYearToken,
          search: (query) => this.tmdbClient.searchMovie(query),
          loadEvidence: this.tmdbClient.getMovieEvidence
            ? (movie) => this.tmdbClient.getMovieEvidence!(movie.id)
            : undefined,
        });
        if (!fallback && result.fallback) {
          fallback = { movie: result.fallback, candidate };
        }
        if (result.match) {
          return this.toMovieInfo(result.match);
        }
        if (result.ambiguous) {
          ambiguousCandidate = candidate;
        }
      }

      const yearHints = [
        ...new Set(
          group.items
            .map(({ year }) => year)
            .filter((year): year is number => year !== null),
        ),
      ];
      const result = await matchTitleVariants({
        title: group.items.map(({ title }) => title),
        search: (query) => this.tmdbClient.searchMovie(query),
        refineAmbiguous: (movies) =>
          yearHints.length === 0
            ? movies
            : movies.filter(
                (movie) =>
                  movie.year !== null && yearHints.includes(movie.year),
              ),
        loadEvidence: this.tmdbClient.getMovieEvidence
          ? (movie) => this.tmdbClient.getMovieEvidence!(movie.id)
          : undefined,
      });
      if (!fallback && result.fallback) {
        fallback = { movie: result.fallback, candidate };
      }
      if (result.match) {
        return this.toMovieInfo(result.match);
      }
      if (result.ambiguous) {
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

  private toMovieInfo(movie: CachedMovie): MovieInfo {
    return {
      kind: "movie",
      title: movie.title,
      year: movie.year,
    };
  }
}
