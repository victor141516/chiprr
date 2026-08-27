import path from "path";
import { describe, expect, it } from "vitest";
import { buildDestinationPath, sanitizePathSegment } from "./MediaPathBuilder";

describe("sanitizePathSegment", () => {
  it("normalizes invalid cross-platform filename characters", () => {
    expect(sanitizePathSegment('Star Wars: A/B <Test> "Cut"?')).toBe(
      "Star Wars - A - B Test Cut",
    );
  });

  it("removes trailing dots and spaces", () => {
    expect(sanitizePathSegment("Movie...   ")).toBe("Movie");
  });

  it("protects Windows device names", () => {
    expect(sanitizePathSegment("CON")).toBe("CON_");
  });
});

describe("buildDestinationPath", () => {
  it("builds a flat canonical movie path with year and original extension", () => {
    expect(
      buildDestinationPath({
        sortedDirectory: "/library/movies",
        originalPath: "/completed/Jurassic.Park.1993.MKV",
        media: { kind: "movie", title: "Jurassic Park", year: 1993 },
      }),
    ).toBe(path.join("/library/movies", "Jurassic Park (1993).MKV"));
  });

  it("omits the movie year when TMDB has none", () => {
    expect(
      buildDestinationPath({
        sortedDirectory: "/library/movies",
        originalPath: "/completed/Unknown.mkv",
        media: { kind: "movie", title: "Unknown", year: null },
      }),
    ).toBe(path.join("/library/movies", "Unknown.mkv"));
  });

  it("preserves the existing show layout", () => {
    expect(
      buildDestinationPath({
        sortedDirectory: "/library/shows",
        originalPath: "/completed/Breaking.Bad.S01E03.mkv",
        media: {
          kind: "show",
          showName: "Breaking Bad",
          season: 1,
          episode: 3,
        },
      }),
    ).toBe(
      path.join(
        "/library/shows",
        "Breaking Bad",
        "Season 1",
        "Breaking Bad S01E03.mkv",
      ),
    );
  });
});
