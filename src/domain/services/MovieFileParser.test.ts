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
        titleWithYearToken: "Jurassic Park 1993",
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
        titleWithYearToken: "Arrival 2016",
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

  it("keeps equivalent file and directory candidates as corroborating evidence", () => {
    expect(
      parser.parse("/completed/movies/Arrival.2016/Arrival.2016.mkv"),
    ).toHaveLength(2);
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

  it("retains a possible year token so the matcher can treat it as part of the title first", () => {
    expect(parser.parse("Odisea.2001.1080p.BluRay.mkv")[0]).toMatchObject({
      title: "Odisea",
      year: 2001,
      titleWithYearToken: "Odisea 2001",
    });
  });

  it("bounds release candidates to the configured movie input directory", () => {
    const inputDirectory = "/data/downloads/completed/Movies";
    const release =
      "Spider Man No Way Home (2021) [BluRay 720p X264 MKV][AC3 5.1 Castellano][www.atomixHQ.LINK]";
    const boundedParser = new MovieFileParser({ inputDirectory });

    expect(
      boundedParser.parse(`${inputDirectory}/${release}/${release}.mkv`),
    ).toEqual([
      {
        title: "Spider Man No Way Home",
        year: 2021,
        titleWithYearToken: "Spider Man No Way Home 2021",
        source: "file",
        sourceName: `${release}.mkv`,
      },
      {
        title: "Spider Man No Way Home",
        year: 2021,
        titleWithYearToken: "Spider Man No Way Home 2021",
        source: "directory",
        sourceName: release,
      },
    ]);
  });
});
