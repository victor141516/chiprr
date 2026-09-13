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
  it("uses removed parenthetical evidence to identify an otherwise ambiguous movie", async () => {
    const nolan = movie({
      id: 1368337,
      title: "The Odyssey",
      year: 2026,
      names: ["la odisea", "the odyssey"],
    });
    const asylum = movie({
      id: 1698863,
      title: "The Odyssey",
      year: 2026,
      names: ["la odisea", "the odyssey"],
    });
    const searchMovie = vi.fn(async (query: string) =>
      query === "La odisea" ? [nolan, asylum] : [],
    );
    const getMovieEvidence = vi.fn(async (id: number) =>
      id === asylum.id ? ["The Asylum", "US"] : ["Syncopy", "US"],
    );
    const matcher = new MovieMatcher({
      tmdbClient: { searchMovie, getMovieEvidence },
      logger: new Logger({ logLevel: "error", name: "MovieMatcherTest" }),
    });

    await expect(
      matcher.match([candidate("La odisea (The Asylum)", 2026)]),
    ).resolves.toEqual({
      kind: "movie",
      title: "The Odyssey",
      year: 2026,
    });
    expect(getMovieEvidence).toHaveBeenCalledWith(asylum.id);
  });

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

  it("matches common title punctuation and separators", async () => {
    const { matcher } = matcherWith([
      [
        movie({
          id: 569094,
          title: "Spider-Man: Across the Spider-Verse",
          year: 2023,
          names: ["spider-man: across the spider-verse"],
        }),
        movie({
          id: 634649,
          title: "Spider-Man: No Way Home",
          year: 2021,
          names: ["spider-man: no way home"],
        }),
      ],
    ]);

    await expect(
      matcher.match([candidate("Spider Man No Way Home", 2021)]),
    ).resolves.toEqual({
      kind: "movie",
      title: "Spider-Man: No Way Home",
      year: 2021,
    });
  });

  it("uses the year to disambiguate identical titles", async () => {
    const oldMovie = movie({ id: 4, title: "The Thing", year: 1982 });
    const newMovie = movie({ id: 5, title: "The Thing", year: 2011 });
    const { matcher, searchMovie } = matcherWith([[oldMovie, newMovie]]);

    await expect(
      matcher.match([candidate("The Thing", 1982)]),
    ).resolves.toMatchObject({ title: "The Thing", year: 1982 });
    expect(searchMovie).toHaveBeenCalledWith("The Thing");
  });

  it("tries a possible year as part of the title before using it as a date", async () => {
    const numericTitle = movie({
      id: 10,
      title: "Odisea 2001",
      year: 1968,
      names: ["odisea 2001"],
    });
    const { matcher, searchMovie } = matcherWith([[numericTitle]]);

    await expect(
      matcher.match([
        {
          ...candidate("Odisea", 2001),
          titleWithYearToken: "Odisea 2001",
        },
      ]),
    ).resolves.toMatchObject({ title: "Odisea 2001", year: 1968 });
    expect(searchMovie).toHaveBeenCalledTimes(1);
    expect(searchMovie).toHaveBeenCalledWith("Odisea 2001");
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

  it("uses a year found in a corroborating parent only when the title is ambiguous", async () => {
    const oldDune = movie({ id: 10, title: "Dune", year: 1984 });
    const newDune = movie({ id: 11, title: "Dune", year: 2021 });
    const { matcher, searchMovie } = matcherWith([
      [oldDune, newDune],
      [oldDune, newDune],
    ]);

    await expect(
      matcher.match([
        candidate("Dune"),
        {
          title: "Dune",
          year: 2021,
          titleWithYearToken: "Dune 2021",
          source: "directory",
          sourceName: "Dune (2021)",
        },
      ]),
    ).resolves.toEqual({ kind: "movie", title: "Dune", year: 2021 });
    expect(searchMovie).toHaveBeenNthCalledWith(1, "Dune 2021");
    expect(searchMovie).toHaveBeenNthCalledWith(2, "Dune");
  });

  it("tries a title corroborated by multiple path elements before unsupported noise", async () => {
    const correctMovie = movie({ id: 12, title: "Arrival", year: 2016 });
    const { matcher, searchMovie } = matcherWith([[correctMovie]]);

    await expect(
      matcher.match([
        candidate("Arrival"),
        {
          title: "Release Final",
          year: null,
          source: "directory",
          sourceName: "Release Final",
        },
        {
          title: "Arrival",
          year: null,
          source: "directory",
          sourceName: "Arrival",
        },
      ]),
    ).resolves.toEqual({
      kind: "movie",
      title: "Arrival",
      year: 2016,
    });
    expect(searchMovie).toHaveBeenCalledTimes(1);
    expect(searchMovie).toHaveBeenCalledWith("Arrival");
  });

  it("reports all attempted candidates when no result exists", async () => {
    const { matcher } = matcherWith([[], []]);

    await expect(
      matcher.match([candidate("Unknown"), candidate("Fallback")]),
    ).rejects.toThrow(/Unknown, Fallback/);
  });
});
