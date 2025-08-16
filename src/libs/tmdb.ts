type SearchResult = {
  results: Array<{
    name: string;
  }>;
  total_results: number;
};

export async function searchShow(query: string, apiToken: string) {
  const url = new URL(
    "https://api.themoviedb.org/3/search/tv?include_adult=true&language=en-US&page=1"
  );
  url.searchParams.set("query", query);

  const result = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
  }).then((res) => res.json() as Promise<SearchResult>);

  return result.results;
}
