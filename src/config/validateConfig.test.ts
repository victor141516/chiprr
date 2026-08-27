import { describe, expect, it } from "vitest";
import { validateMovieDirectoryConfig } from "./validateConfig";

describe("validateMovieDirectoryConfig", () => {
  it("accepts a configuration without movie directories", () => {
    expect(validateMovieDirectoryConfig({})).toEqual({});
  });

  it("accepts a configuration with both movie directories", () => {
    const config = {
      movieInputDirectory: "/completed/movies",
      movieSortedDirectory: "/library/movies",
    };

    expect(validateMovieDirectoryConfig(config)).toBe(config);
  });

  it("rejects a movie input directory without a sorted directory", () => {
    expect(() =>
      validateMovieDirectoryConfig({
        movieInputDirectory: "/completed/movies",
      }),
    ).toThrow(/must be configured together/);
  });

  it("rejects a movie sorted directory without an input directory", () => {
    expect(() =>
      validateMovieDirectoryConfig({
        movieSortedDirectory: "/library/movies",
      }),
    ).toThrow(/must be configured together/);
  });
});
