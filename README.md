<p align="center">
  <picture>
    <source srcset="logo-dark.svg" media="(prefers-color-scheme: dark)">
    <img src="logo.svg" alt="chiprr logo" width="200"/>
  </picture>
</p>

# chiprr

A lightweight organizer for completed TV-show and movie downloads. Chiprr watches completed-download directories, identifies video files with TMDB, and creates canonical hard links in media-library directories.

It does not choose or manage downloads, maintain a catalog database, or move the original files. qBittorrent, a manual download workflow, or another tool remains in control of downloads; Chiprr only organizes completed video files.

## Features

- **TV-show organization** into `Show Name/Season N/Show Name SxxEyy.ext`.
- **Movie organization** into a flat `Movie Title (Year).ext` directory.
- **Hard links** preserve the completed download without duplicating its data.
- **TMDB matching** resolves canonical English titles from English or localized input names.
- **Movie-year disambiguation** distinguishes titles with multiple releases.
- **Watch mode** handles newly completed files without scanning old files at startup.
- **Execute mode** performs an explicit recursive scan for recovery or initial imports.
- **Independent pipelines** let a show failure and movie failure remain isolated.
- **Persistent, namespaced TMDB cache** avoids collisions between movies and shows.
- **`.chiprrignore` support** applies gitignore-style rules to both input trees.
- **Cross-platform canonical names** are safe on Linux, macOS, and Windows.

## Intended workflow

```text
qBittorrent incomplete directory
        │ download completes
        ▼
qBittorrent completed Shows/Movies directories
        │ Chiprr watches only these completed directories
        ▼
Chiprr creates hard links
        ▼
Organized Shows/Movies library
        │
        └── Jellyfin, Plex, Nestrr, or another media catalog
```

Chiprr has no API, webhook, or database relationship with the media catalog. The canonical filesystem layout is the contract.

## Library layout

### TV shows

Input:

```text
/data/downloads/completed/Shows/Breaking.Bad.S01E03.720p.BluRay.x264.mkv
```

Output hard link:

```text
/data/library/Shows/Breaking Bad/Season 1/Breaking Bad S01E03.mkv
```

### Movies

Input:

```text
/data/downloads/completed/Movies/Jurassic.Park.1993.1080p.BluRay.x264-GROUP.mkv
```

Output hard link:

```text
/data/library/Movies/Jurassic Park (1993).mkv
```

The movie library is flat: Chiprr does not create a directory per movie. It includes TMDB's release year whenever one is available and preserves the original video extension.

## Requirements

- Bun.
- A TMDB API Read Access Token.
- Read access to completed-download directories.
- Write access to organized-library directories.
- A filesystem that supports hard links.
- Every input directory and its corresponding library directory must be on the same filesystem.

Hard links cannot cross filesystems. In Docker, mount a common parent such as `/srv/media-data:/data` instead of mounting completed and library directories as unrelated volumes. Separate bind mounts may behave as different mount points even when their host paths live on the same disk.

## Installation

```bash
git clone https://github.com/victor141516/chiprr.git
cd chiprr
bun install --frozen-lockfile
```

Run locally:

```bash
bun run src/main.ts \
  --input-directory /data/downloads/completed/Shows \
  --sorted-directory /data/library/Shows \
  --movie-input-directory /data/downloads/completed/Movies \
  --movie-sorted-directory /data/library/Movies \
  --tmdb-token "$TMDB_TOKEN"
```

## Configuration

Command-line arguments override environment variables. Environment variables override `.env` values.

| CLI argument               | Environment variable     | Required | Default                   | Description                                |
| -------------------------- | ------------------------ | -------- | ------------------------- | ------------------------------------------ |
| `--input-directory`        | `INPUT_DIRECTORY`        | Yes      | —                         | Completed TV-show downloads to watch/scan. |
| `--sorted-directory`       | `SORTED_DIRECTORY`       | Yes      | —                         | Organized TV-show library root.            |
| `--movie-input-directory`  | `MOVIE_INPUT_DIRECTORY`  | No\*     | —                         | Completed movie downloads to watch/scan.   |
| `--movie-sorted-directory` | `MOVIE_SORTED_DIRECTORY` | No\*     | —                         | Flat organized movie library root.         |
| `--tmdb-token`             | `TMDB_TOKEN`             | Yes      | —                         | TMDB API Read Access Token.                |
| `--replace-if-exists`      | `REPLACE_IF_EXISTS`      | No       | `false`                   | Replace an existing canonical hard link.   |
| `--mode`                   | —                        | No       | `watch`                   | `watch` or `execute`.                      |
| `--log-level`              | `LOG_LEVEL`              | No       | `info`                    | `error`, `warn`, `info`, or `debug`.       |
| `--cache-file-path`        | `CACHE_FILE_PATH`        | No       | `.cache/tmdb-cache.jsonl` | Persistent TMDB JSONL cache.               |

`*` Movie directories are optional as a feature, but they are an all-or-nothing pair. Chiprr fails configuration validation if only one is supplied.

The existing show-only configuration remains valid:

```bash
export INPUT_DIRECTORY=/data/downloads/completed/Shows
export SORTED_DIRECTORY=/data/library/Shows
export TMDB_TOKEN=your_tmdb_read_access_token

bun run src/main.ts
```

Enable movies by adding both variables:

```bash
export MOVIE_INPUT_DIRECTORY=/data/downloads/completed/Movies
export MOVIE_SORTED_DIRECTORY=/data/library/Movies
```

## Docker

Build the image:

```bash
docker build -t chiprr .
```

Run with one common host mount so hard links remain possible:

```bash
docker run --rm \
  -e INPUT_DIRECTORY=/data/downloads/completed/Shows \
  -e SORTED_DIRECTORY=/data/library/Shows \
  -e MOVIE_INPUT_DIRECTORY=/data/downloads/completed/Movies \
  -e MOVIE_SORTED_DIRECTORY=/data/library/Movies \
  -e TMDB_TOKEN="$TMDB_TOKEN" \
  -e CACHE_FILE_PATH=/cache/tmdb-cache.jsonl \
  -v /srv/media-data:/data \
  -v /srv/chiprr-cache:/cache \
  chiprr
```

An equivalent Compose example is available in [`docker-compose.example.yml`](docker-compose.example.yml).

### qBittorrent setup

The recommended qBittorrent configuration is:

```text
/srv/media-data/
├── downloads/
│   ├── incomplete/          # Never watched by Chiprr
│   └── completed/
│       ├── Shows/           # INPUT_DIRECTORY
│       └── Movies/          # MOVIE_INPUT_DIRECTORY
└── library/
    ├── Shows/               # SORTED_DIRECTORY
    └── Movies/              # MOVIE_SORTED_DIRECTORY
```

Configure qBittorrent categories such as `Shows` and `Movies` to place completed torrents in their respective completed directories. Chiprr assumes qBittorrent moves a download out of the incomplete directory only after completion. Chiprr does not create categories, submit torrents, or query download progress.

## Modes

### Watch mode (default)

```bash
bun run src/main.ts --mode watch
```

- Starts one watcher for shows and, when configured, one for movies.
- Uses `ignoreInitial: true`: files already present at startup are not processed.
- Handles newly created completed files.
- Isolates per-file and per-pipeline errors so one bad media item does not stop the other pipeline.

There is intentionally no implicit startup rescan.

### Execute mode

```bash
bun run src/main.ts --mode execute
```

- Recursively scans every configured completed directory.
- Applies `.chiprrignore` rules.
- Processes supported video files with the same parser, matcher, and hard-link logic as watch mode.
- Logs per-kind success/failure totals and exits.

Use execute mode manually for an initial import or to recover files added while Chiprr was stopped.

## Movie identification

Chiprr builds candidates from the video filename first and then from parent directories, closest first. This allows a nested release such as:

```text
/completed/Movies/Arrival (2016)/ARRIVAL_FINAL.mkv
```

to fall back from `ARRIVAL FINAL` to `Arrival (2016)`.

The parser:

- extracts an optional release year;
- removes common resolution, source, edition, video-codec, and audio-codec markers;
- normalizes dots and underscores;
- preserves Unicode/diacritics for matching;
- avoids treating numeric titles such as `1917` or `2001: A Space Odyssey` as release years.

The matcher searches TMDB's movie endpoint and translation endpoint. It compares the candidate against the search title, original title, and translated titles case-insensitively and without diacritics.

Selection priority:

1. Exact translated/original/title match with the extracted year.
2. A single exact title match when no year is available.
3. A single exact title whose TMDB year is unknown.
4. The first TMDB result as a logged warning only when no exact or ambiguous match exists.

Ambiguous exact-title matches are rejected rather than linked arbitrarily. Logs include the attempted filename/directory candidates.

The output title is TMDB's English title. If no English translation exists, Chiprr falls back deterministically to `original_title` and then the selected search-result title.

## Canonical filename sanitization

Chiprr's output sanitization is the source-of-truth contract for catalogs that derive paths independently:

1. Remove control characters.
2. Convert `/`, `\`, and `:` to a spaced dash (`-`).
3. Convert `<`, `>`, `"`, `|`, `?`, and `*` to spaces.
4. Collapse repeated whitespace.
5. Trim leading/trailing whitespace and trailing dots.
6. Add `_` to Windows-reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, and `LPT1`–`LPT9`).
7. Preserve Unicode characters and diacritics.

The same title sanitization is applied to canonical show names and movie titles.

## Existing destinations

By default, an existing destination produces an error and remains untouched. Chiprr never silently overwrites it.

Set `REPLACE_IF_EXISTS=true` or pass `--replace-if-exists` to unlink the old destination and create a hard link to the newly processed source. The original completed download is never deleted.

## Supported files

Video extensions:

- `mp4`, `avi`, `mov`, `wmv`, `webm`, `flv`, `m4v`
- `mkv`, `vob`, `ts`, `3gp`, `asf`, `divx`

TV episode patterns currently include:

- `S01E01`
- `1x01`
- `Cap.101` / `Capitulo 101`
- combinations where season and episode markers occur separately

## `.chiprrignore`

Place a `.chiprrignore` file anywhere under a completed input directory. Rules apply hierarchically using gitignore syntax.

An empty or whitespace-only `.chiprrignore` ignores the entire directory tree below it:

```bash
touch /data/downloads/completed/Movies/unwanted-release/.chiprrignore
```

A non-empty file can select patterns:

```gitignore
# Ignore samples and extras
*sample*
extras/

# Ignore unwanted video variants
*trailer*

# Negation is supported
!important.mkv
```

Common syntax:

- `*.log` — extension pattern.
- `**/*.tmp` — recursive pattern.
- `folder/` — entire directory.
- `*sample*` — substring/wildcard.
- `!important.mkv` — negation.
- `# comment` — comment.

Rules in parent and child `.chiprrignore` files are combined.

## TMDB cache

The JSONL cache is persistent and debounced. Search keys include the media kind, normalized query, and movie year when supplied, so a movie and TV show with the same title cannot collide.

Legacy show cache entries written before movie support remain readable. New entries always use the namespaced format.

## Initial limitations

- One video file represents one movie or one TV episode.
- Sidecar subtitles, NFO metadata, artwork, and other auxiliary files are not organized.
- Multi-part movies and disc/BDMV folders are unsupported.
- Multiple movies in one file are unsupported.
- Multi-episode TV files are unsupported.
- Anime absolute numbering is unsupported.
- Specials and season zero are unsupported.
- Chiprr does not choose among multiple qualities or upgrade existing media automatically.
- Chiprr does not communicate with Nestrr, Jellyfin, Plex, qBittorrent, or another catalog/download service.

## Development

```bash
bun install --frozen-lockfile
bunx tsc --noEmit
bun test
```

The test suite includes parser/matcher unit tests, TMDB HTTP/cache tests, configuration validation, watcher/execute isolation, ignore rules, real filesystem hard-link tests, and an end-to-end movie organization test.

## License

MIT

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss the desired behavior and filesystem contract.
