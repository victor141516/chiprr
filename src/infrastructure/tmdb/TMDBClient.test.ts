import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../logging/Logger";
import { TMDBCache } from "./TMDBCache";
import { TMDBClient } from "./TMDBClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("TMDBClient movie support", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function client(): TMDBClient {
    return new TMDBClient({
      apiToken: "token",
      cache: new TMDBCache({
        logger: new Logger({ logLevel: "error", name: "TMDBCacheTest" }),
      }),
      logger: new Logger({ logLevel: "error", name: "TMDBClientTest" }),
    });
  }

  it("uses movie search/translations and returns the English title", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_results: 1,
          results: [
            {
              id: 10,
              title: "El laberinto del fauno",
              original_title: "El laberinto del fauno",
              release_date: "2006-10-11",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          translations: [
            {
              iso_3166_1: "ES",
              iso_639_1: "es",
              data: { title: "El laberinto del fauno" },
            },
            {
              iso_3166_1: "US",
              iso_639_1: "en",
              data: { title: "Pan's Labyrinth" },
            },
          ],
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      client().searchMovie("El laberinto del fauno", 2006),
    ).resolves.toEqual([
      {
        id: 10,
        title: "Pan's Labyrinth",
        originalTitle: "El laberinto del fauno",
        year: 2006,
        names: ["el laberinto del fauno", "pan's labyrinth"],
      },
    ]);

    const searchUrl = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(searchUrl.pathname).toBe("/3/search/movie");
    expect(searchUrl.searchParams.get("query")).toBe("El laberinto del fauno");
    expect(searchUrl.searchParams.get("year")).toBe("2006");
    expect(String(fetchMock.mock.calls[1]![0])).toContain(
      "/3/movie/10/translations",
    );
  });

  it("falls back to original_title when no English translation exists", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_results: 1,
          results: [
            {
              id: 11,
              title: "Seven Samurai",
              original_title: "七人の侍",
              release_date: "1954-04-26",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          translations: [
            {
              iso_3166_1: "JP",
              iso_639_1: "ja",
              data: { title: "七人の侍" },
            },
          ],
        }),
      ) as unknown as typeof fetch;

    const result = await client().searchMovie("Seven Samurai", 1954);
    expect(result[0]?.title).toBe("七人の侍");
  });

  it("reports non-successful TMDB responses", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({}, 503)) as unknown as typeof fetch;

    await expect(client().searchMovie("Arrival")).rejects.toThrow(
      /TMDB request failed \(503/,
    );
  });
});
