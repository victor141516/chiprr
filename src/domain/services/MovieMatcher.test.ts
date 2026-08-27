import { describe, expect, it, vi } from "vitest";
import { Logger } from "../../infrastructure/logging/Logger";
import type { CachedMovie } from "../../infrastructure/tmdb/TMDBCache";
import { MovieMatcher, type MovieSearchClient } from "./MovieMatcher";
import type { MovieCandidate } from "./MovieFileParser";

function movie(
  overrides: Partial<CachedMovie> & Pick<CachedMovie, "id" | "title">,
): CachedMovie {
  return {
    names: [overrides.title.toLocaleLowerCase()],
    originalTitle: overrides.title,
    year: null,
    ...overrides,
  };
}

function candidate(title: string, year: number | null = null): MovieCandidate {
  return { title, year, source: "file", sourceName: `${title}.mkv` };
}

function matcherWith(results: CachedMovie[][]): {
  matcher: MovieMatcher;
  searchMovie: ReturnType<typeof vi.fn>;
} {
  const searchMovie = vi.fn();
  for (const result of results) {
    searchMovie.mockResolvedValueOnce(result);
  }
  return {
    matcher: new MovieMatcher({
      tmdbClient: { searchMovie } as MovieSearchClient,
      logger: new Logger({ logLevel: "error", name: "MovieMatcherTest" }),
    }),
    searchMovie,
  };
}

describe("MovieMatcher", () => {
  it("matches an exact English title", async () => {
    const { matcher } = matcherWith([
      [movie({ id: 1, title: "Arrival", year: 2016 })],
    ]);

    await expect(matcher.match([candidate("Arrival")])).resolves.toEqual({
      kind: "movie",
      title: "Arrival",
      year: 2016,
    });
  });

  it("matches a translated title but returns the canonical English title", async () => {
    const { matcher } = matcherWith([
      [
        movie({
          id: 2,
          title: "Pan's Labyrinth",
          originalTitle: "El laberinto del fauno",
          year: 2006,
          names: ["pan's labyrinth", "el laberinto del fauno"],
        }),
      ],
    ]);

    await expect(
      matcher.match([candidate("El laberinto del fauno", 2006)]),
    ).resolves.toMatchObject({ title: "Pan's Labyrinth", year: 2006 });
  });

  it("matches titles without diacritics", async () => {
    const { matcher } = matcherWith([
      [
        movie({
          id: 3,
          title: "Amélie",
          year: 2001,
          names: ["amélie"],
        }),
      ],
    ]);

    await expect(
      matcher.match([candidate("Amelie", 2001)]),
    ).resolves.toMatchObject({
      title: "Amélie",
    });
  });

  it("uses the year to disambiguate identical titles", async () => {
    const oldMovie = movie({ id: 4, title: "The Thing", year: 1982 });
    const newMovie = movie({ id: 5, title: "The Thing", year: 2011 });
    const { matcher, searchMovie } = matcherWith([[oldMovie, newMovie]]);

    await expect(
      matcher.match([candidate("The Thing", 1982)]),
    ).resolves.toMatchObject({ title: "The Thing", year: 1982 });
    expect(searchMovie).toHaveBeenCalledWith("The Thing", 1982);
  });

  it("rejects an ambiguous title when no year is available", async () => {
    const { matcher } = matcherWith([
      [
        movie({ id: 6, title: "The Thing", year: 1982 }),
        movie({ id: 7, title: "The Thing", year: 2011 }),
      ],
    ]);

    await expect(matcher.match([candidate("The Thing")])).rejects.toThrow(
      /Ambiguous TMDB movie match/,
    );
  });

  it("uses a deterministic original-title fallback supplied by TMDBClient", async () => {
    const { matcher } = matcherWith([
      [
        movie({
          id: 8,
          title: "七人の侍",
          originalTitle: "七人の侍",
          year: 1954,
          names: ["seven samurai", "七人の侍"],
        }),
      ],
    ]);

    await expect(
      matcher.match([candidate("Seven Samurai", 1954)]),
    ).resolves.toMatchObject({ title: "七人の侍", year: 1954 });
  });

  it("falls back to a parent-directory candidate", async () => {
    const { matcher } = matcherWith([
      [],
      [movie({ id: 9, title: "Arrival", year: 2016 })],
    ]);

    await expect(
      matcher.match([
        candidate("ARRIVAL FINAL"),
        {
          title: "Arrival",
          year: 2016,
          source: "directory",
          sourceName: "Arrival (2016)",
        },
      ]),
    ).resolves.toMatchObject({ title: "Arrival", year: 2016 });
  });

  it("reports all attempted candidates when no result exists", async () => {
    const { matcher } = matcherWith([[], []]);

    await expect(
      matcher.match([candidate("Unknown"), candidate("Fallback")]),
    ).rejects.toThrow(/Unknown, Fallback/);
  });
});
