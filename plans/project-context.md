# Chiprr project context

## Purpose

Chiprr organizes completed TV-show and movie video files into canonical media-library paths using hard links. It does not manage downloads or maintain a catalog database.

The current public contract is documented in `README.md`. This file summarizes the implementation boundaries for contributors.

## Runtime pipelines

The show pipeline is always configured with:

- `INPUT_DIRECTORY`
- `SORTED_DIRECTORY`

The optional movie pipeline is enabled only when both are configured:

- `MOVIE_INPUT_DIRECTORY`
- `MOVIE_SORTED_DIRECTORY`

Both pipelines share video detection, TMDB client/cache, ignore behavior, logging, watch/execute runners, and hard-link infrastructure. Their parsers, matchers, and output layouts remain type-safe and separate.

Watch mode uses Chokidar with `ignoreInitial: true`; it never performs an implicit startup scan. Execute mode is the explicit recursive recovery/import operation.

## Architecture

### Application

- `application/createMediaPipelines.ts` builds the required show pipeline and optional movie pipeline.
- `application/MediaPipelineRunner.ts` runs configured pipelines in watch or execute mode and isolates failures between media kinds.

### Domain models

`MatchedMedia` is a discriminated union:

```ts
type MatchedMedia =
  | { kind: "show"; showName: string; season: number; episode: number }
  | { kind: "movie"; title: string; year: number | null };
```

### TV shows

- `VideoFileParser` extracts show/season/episode candidates from path elements.
- `ShowMatcher` matches show candidates with TMDB and returns an `EpisodeInfo`.
- Existing supported patterns and behavior remain backward-compatible.

Output:

```text
<shows root>/<show>/Season <N>/<show> S<xx>E<yy>.<extension>
```

### Movies

- `MovieFileParser` extracts ordered title/year candidates from the filename and then parent directories, closest first.
- It removes common release metadata while preserving localized titles and numeric titles such as `1917`.
- `MovieMatcher` compares candidates to TMDB titles, original titles, and translations case/diacritic-insensitively.
- Title + year outranks title-only matching.
- Ambiguous exact matches are rejected.
- A first-result fallback is allowed only for a non-exact, non-ambiguous search and is logged as a warning.

Output:

```text
<movies root>/<English TMDB title> (<year>).<extension>
```

The year is omitted only when TMDB has no release year.

### TMDB

- `TMDBClient.searchShow()` uses `/3/search/tv` and `/3/tv/{id}/translations`.
- `TMDBClient.searchMovie()` uses `/3/search/movie` and `/3/movie/{id}/translations`.
- Movie canonical title preference: English translation, `original_title`, selected search title.
- `TMDBCache` namespaces keys by media kind, normalized query, and optional movie year.
- Legacy unprefixed show cache entries remain readable.

### Filesystem

- `DirectoryScanner` recursively enumerates explicit execute-mode inputs.
- `FileWatcher` watches only newly created paths.
- `IgnoreFilter` applies hierarchical `.chiprrignore` rules.
- `MediaPathBuilder` is the canonical path/sanitization contract.
- `HardLinkCreator` creates links, preserves originals, and applies explicit replacement behavior.

Hard links require completed and organized directories to share a filesystem and, in containers, an appropriate common mount.

## Canonical sanitization

`sanitizePathSegment()`:

1. removes control characters;
2. maps path separators and colons to `-`;
3. maps other Windows-invalid characters to spaces;
4. collapses whitespace and removes trailing dots/spaces;
5. protects Windows device names with `_`;
6. preserves Unicode and diacritics.

Catalogs that derive Chiprr paths must reproduce this behavior exactly.

## Testing

Run:

```bash
bunx tsc --noEmit
bun test
```

Coverage includes:

- legacy show parsing/matching;
- movie parsing, translations, diacritics, years, ambiguity, and fallback;
- TMDB endpoints and cache namespaces;
- both-or-neither movie configuration validation;
- show/movie watch and execute isolation;
- no implicit initial watcher events;
- `.chiprrignore` recursion/patterns;
- canonical path sanitization;
- real hard-link creation, collision, and replacement;
- an end-to-end localized movie organization pipeline.

## Explicit limitations

- One video file per movie or episode.
- No sidecars, disc folders, multi-part movies, multi-episode files, anime absolute numbering, specials, or season zero.
- No qBittorrent, Nestrr, Jellyfin, Plex, or other service API integration.
- No automatic startup rescan.
