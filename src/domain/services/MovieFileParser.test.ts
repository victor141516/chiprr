import { describe, expect, it } from "vitest";
import { MovieFileParser } from "./MovieFileParser";

describe("MovieFileParser", () => {
  const parser = new MovieFileParser();

  it("extracts a dotted title and year before release metadata", () => {
    expect(
      parser.parse(
        "/completed/movies/Jurassic.Park.1993.1080p.BluRay.x264-GROUP.mkv",
      ),
    ).toEqual([
      {
        title: "Jurassic Park",
        year: 1993,
        source: "file",
        sourceName: "Jurassic.Park.1993.1080p.BluRay.x264-GROUP.mkv",
      },
    ]);
  });

  it("preserves localized titles and diacritics", () => {
    expect(parser.parse("Amélie.2001.1080p.WEB-DL.mkv")[0]).toMatchObject({
      title: "Amélie",
      year: 2001,
    });
  });

  it("supports a movie without a release year", () => {
    expect(parser.parse("Arrival.1080p.BluRay.mkv")[0]).toMatchObject({
      title: "Arrival",
      year: null,
    });
  });

  it("returns nested parent directories as fallback candidates", () => {
    expect(
      parser.parse("/completed/movies/Arrival (2016)/ARRIVAL_FINAL.mkv"),
    ).toEqual([
      {
        title: "ARRIVAL FINAL",
        year: null,
        source: "file",
        sourceName: "ARRIVAL_FINAL.mkv",
      },
      {
        title: "Arrival",
        year: 2016,
        source: "directory",
        sourceName: "Arrival (2016)",
      },
    ]);
  });

  it("removes edition, quality, codec, and source markers", () => {
    expect(
      parser.parse(
        "Some.Movie.EXTENDED.2016.2160p.UHD.BluRay.REMUX.HEVC.mkv",
      )[0],
    ).toMatchObject({ title: "Some Movie", year: 2016 });
  });

  it("deduplicates equivalent file and directory candidates", () => {
    expect(
      parser.parse("/completed/movies/Arrival.2016/Arrival.2016.mkv"),
    ).toHaveLength(1);
  });

  it("does not confuse a numeric movie title with its release year", () => {
    expect(
      parser.parse("2001.A.Space.Odyssey.1968.1080p.BluRay.mkv")[0],
    ).toMatchObject({ title: "2001 A Space Odyssey", year: 1968 });
    expect(parser.parse("1917.1080p.BluRay.mkv")[0]).toMatchObject({
      title: "1917",
      year: null,
    });
  });
});
