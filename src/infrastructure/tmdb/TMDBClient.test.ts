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

  it("collects exact movie disambiguation evidence from TMDB details", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        title: "The Odyssey",
        original_title: "The Odyssey",
        release_date: "2026-07-03",
        original_language: "en",
        production_companies: [
          { name: "The Asylum", origin_country: "US" },
        ],
        production_countries: [
          { iso_3166_1: "US", name: "United States of America" },
        ],
        spoken_languages: [
          { iso_639_1: "en", english_name: "English", name: "English" },
        ],
        credits: {
          cast: [{ name: "Daniel O'Reilly" }],
          crew: [
            {
              name: "Christopher Ray",
              job: "Director",
              department: "Directing",
            },
            {
              name: "Someone Else",
              job: "Producer",
              department: "Production",
            },
          ],
        },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(client().getMovieEvidence(1698863)).resolves.toEqual(
      expect.arrayContaining([
        "The Asylum",
        "US",
        "2026",
        "Christopher Ray",
        "Daniel O'Reilly",
      ]),
    );
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "/3/movie/1698863?",
    );
  });

  it("keeps every direct show title match so evidence can disambiguate them", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        total_results: 2,
        results: [
          { id: 1, name: "The Office", original_name: "The Office" },
          { id: 2, name: "The Office", original_name: "The Office" },
        ],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(client().searchShow("The Office")).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("collects show creators, networks, countries, and companies as evidence", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        name: "The Office",
        original_name: "The Office",
        first_air_date: "2005-03-24",
        original_language: "en",
        origin_country: ["US"],
        created_by: [{ name: "Greg Daniels" }],
        networks: [{ name: "NBC", origin_country: "US" }],
        production_companies: [
          { name: "Universal Television", origin_country: "US" },
        ],
        production_countries: [
          { iso_3166_1: "US", name: "United States of America" },
        ],
        spoken_languages: [
          { iso_639_1: "en", english_name: "English", name: "English" },
        ],
      }),
    ) as unknown as typeof fetch;

    await expect(client().getShowEvidence(2316)).resolves.toEqual(
      expect.arrayContaining([
        "2005",
        "US",
        "Greg Daniels",
        "NBC",
        "Universal Television",
      ]),
    );
  });

  it("routes search and translation requests through a configured base URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total_results: 1,
          results: [
            {
              id: 42,
              title: "Temporal Horizon",
              original_title: "Temporal Horizon",
              release_date: "2026-02-20",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ translations: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const configuredClient = new TMDBClient({
      apiToken: "token",
      baseUrl: "http://mock-tmdb:9090/3/",
      cache: new TMDBCache({
        logger: new Logger({ logLevel: "error", name: "TMDBCacheTest" }),
      }),
      logger: new Logger({ logLevel: "error", name: "TMDBClientTest" }),
    });

    await configuredClient.searchMovie("Temporal Horizon", 2026);

    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /^http:\/\/mock-tmdb:9090\/3\/search\/movie\?/,
    );
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      "http://mock-tmdb:9090/3/movie/42/translations",
    );
  });
});
