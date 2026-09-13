import { describe, expect, it } from "vitest";
import { Logger } from "../logging/Logger";
import { TMDBCache, type CachedMovie, type CachedShow } from "./TMDBCache";

describe("TMDBCache media namespaces", () => {
  it("does not collide when a show and movie use the same query", () => {
    const cache = new TMDBCache({
      logger: new Logger({ logLevel: "error", name: "TMDBCacheTest" }),
    });
    const shows: CachedShow[] = [{ id: 1, name: "Fargo", names: ["fargo"] }];
    const movies: CachedMovie[] = [
      {
        id: 2,
        title: "Fargo",
        originalTitle: "Fargo",
        names: ["fargo"],
        year: 1996,
      },
    ];

    cache.setSearch("show", "Fargo", shows);
    cache.setSearch("movie", "Fargo", movies, 1996);

    expect(cache.getSearch("show", "Fargo")).toEqual(shows);
    expect(cache.getSearch("movie", "Fargo", 1996)).toEqual(movies);
  });
});
