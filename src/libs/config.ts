export const TMDB_TOKEN = process.env.TMDB_TOKEN!;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_TOKEN is not defined");
}
