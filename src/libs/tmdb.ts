import { logger } from "./logger";

type SearchResult = {
  results: Array<{
    id: number;
    name: string;
  }>;
  total_results: number;
};

type LanguageVariationsResult = {
  translations: Array<{
    english_name: "English";
    data: {
      name: string;
    };
  }>;
};

const cache: Record<
  string,
  {
    names: string[];
    id: number;
    name: string;
  }[]
> = {};

export async function searchShow(query: string, apiToken: string) {
  if (cache[query]) return cache[query];

  const url = new URL(
    "https://api.themoviedb.org/3/search/tv?include_adult=true&language=en-US&page=1"
  );
  url.searchParams.set("query", query);

  const searchResult = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
  }).then((res) => res.json() as Promise<SearchResult>);

  logger.debug(`[TMDB] Search API result: ${JSON.stringify(searchResult)}`);

  const exactMatch = searchResult.results.find(({ name }) => {
    return name.toLocaleLowerCase() === query;
  });

  let result!: (typeof cache)[string];

  if (exactMatch) {
    logger.debug(`[TMDB] Exact match found: ${JSON.stringify(exactMatch)}`);
    result = [{ ...exactMatch, names: [exactMatch.name] }];
  } else {
    logger.debug(`[TMDB] Exact match NOT found. Trying language variations`);
    result = await Promise.all(
      searchResult.results.map(async (e) => {
        const names = [
          e.name,
          ...(await languageVariations(e.id, apiToken)),
        ].map((e) => e.toLowerCase());
        return { ...e, names };
      })
    );
    logger.debug(
      `[TMDB] Language variations founded: ${JSON.stringify(result)}`
    );
  }

  cache[query] = result;

  return result;
}

async function languageVariations(showId: number, apiToken: string) {
  const url = new URL(`https://api.themoviedb.org/3/tv/${showId}/translations`);

  const result = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
  }).then((res) => res.json() as Promise<LanguageVariationsResult>);

  return result.translations.map((e) => e.data.name).filter((e) => e !== "");
}
