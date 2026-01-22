<p align="center">
  <picture>
    <source srcset="logo-dark.svg" media="(prefers-color-scheme: dark)">
    <img src="logo.svg" alt="chiprr logo" width="200"/>
  </picture>
</p>

# chiprr

A lightweight, simple alternative to Sonarr for automatically organizing TV show files. chiprr watches a directory for new video files and organizes them into a clean folder structure using hard links.

## Features

- 🎬 **Automatic TV Show Organization** - Watches for new video files and organizes them into `Show Name/Season X/` structure
- 📁 **Hard Link Creation** - Creates hard links instead of copying files, saving disk space
- 🎯 **Smart Episode Detection** - Supports multiple naming formats (S01E01, 1x01, Cap.101, etc.)
- 🔍 **TMDB Integration** - Uses The Movie Database API to normalize and match show names
- 🌍 **International Support** - Handles diacritics and multiple language variations
- 📝 **Flexible Filename Parsing** - Works with various release formats and naming conventions
- 🚫 **Ignore Files Support** - Use `.chiprrignore` files to exclude unwanted files and directories (gitignore syntax)

## Why chiprr?

**Sometimes you just want your files organized.**

If you've ever felt that Sonarr is overkill for your needs, chiprr might be for you. Here's what makes it different:

### 🎯 Stay in Control

With chiprr, you choose what to download and when. Use your favorite torrent client, download manager, or even copy files manually. chiprr doesn't care how the files get there - it just organizes them when they arrive.

### 🚀 Zero Configuration Media Management

No need to:

- Set up a web interface
- Configure quality profiles
- Manage indexers
- Track upcoming episodes
- Maintain a database

Just point chiprr at your download folder and your media library, and you're done.

### 🔧 Works With Your Existing Workflow

Whether you:

- Manually select torrents based on specific encoders or quality
- Use RSS feeds from your favorite trackers
- Download from Usenet, DDL, or anywhere else
- Have someone else managing the downloads

chiprr simply watches and organizes. Your downloads, your rules.

### 📺 Perfect for Jellyfin/Plex

chiprr organizes your files exactly how media servers expect them:

```
TV Shows/
├── Breaking Bad/
│   ├── Season 1/
│   │   ├── Breaking Bad S01E01.mkv
│   │   ├── Breaking Bad S01E02.mkv
│   │   └── ...
│   └── Season 2/
│       └── ...
└── Better Call Saul/
    └── ...
```

No complex setup, no metadata agents, no confusion. Just clean, organized files that any media server can understand.

### 💡 When to Use chiprr

chiprr is perfect if you:

- Already have a download workflow you're happy with
- Want to keep using your favorite torrent client
- Prefer to hand-pick your downloads
- Need something that "just works" without complex configuration
- Want your files organized for Jellyfin/Plex/Emby/Kodi

chiprr is **not** for you if you:

- Want fully automated downloading based on air dates
- Need complex quality upgrade rules
- Want to track your watching progress
- Prefer an all-in-one solution with web UI

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/chiprr.git
cd chiprr

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

chiprr can be configured using command-line arguments or environment variables:

### Command Line Arguments

```bash
# Watch mode (continuous monitoring)
node main.js \
  --input-directory /path/to/downloads \
  --sorted-directory /path/to/organized/shows \
  --tmdb-token your_tmdb_api_token \
  --log-level debug \
  --cache-file-path /app-cache/tmdb.json \
  --mode watch

# Execute mode (one-time scan)
node main.js \
  --input-directory /path/to/downloads \
  --sorted-directory /path/to/organized/shows \
  --tmdb-token your_tmdb_api_token \
  --mode execute
```

### Environment Variables

```bash
export INPUT_DIRECTORY=/path/to/downloads
export SORTED_DIRECTORY=/path/to/organized/shows
export TMDB_TOKEN=your_tmdb_api_token
export LOG_LEVEL=info
export CACHE_FILE_PATH=/path/to/cache.json
```

### Options

| Option               | Short | Environment Variable | Description                                                       | Required                               |
| -------------------- | ----- | -------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `--input-directory`  | `-i`  | `INPUT_DIRECTORY`    | Directory to watch for new video files                            | Yes                                    |
| `--sorted-directory` | `-s`  | `SORTED_DIRECTORY`   | Directory where organized files will be linked                    | Yes                                    |
| `--tmdb-token`       | `-t`  | `TMDB_TOKEN`         | TMDB API token for show name matching                             | Yes                                    |
| `--mode`             | `-m`  | -                    | Execution mode: `watch` (continuous) or `execute` (one-time scan) | No (default: watch)                    |
| `--log-level`        | `-l`  | `LOG_LEVEL`          | Logging level (error, warn, info, debug)                          | No (default: info)                     |
| `--cache-file-path`  | `-c`  | `CACHE_FILE_PATH`    | Path to the cache for TMDB API requests                           | No (default: ./.cache/tmdb-cache.json) |

## Getting a TMDB Token

1. Visit [The Movie Database](https://www.themoviedb.org/)
2. Create an account or log in
3. Go to Settings → API
4. Request an API key (choose "Developer" for personal use)
5. Copy your API Read Access Token (Bearer token)

Note: By default, a cache file will be created and it will be reused even if you restart the app. If you are using Docker, you may want to create a volume for this file.

## Usage

chiprr supports two execution modes:

### Watch Mode (Default)

Continuously monitors the input directory for new files:

```bash
node main.js --mode watch
# or simply
node main.js
```

In watch mode, chiprr will:

1. Watch the input directory for new video files
2. Parse the filename to extract show name, season, and episode
3. Query TMDB to get the official show name
4. Create a hard link in the sorted directory with a clean, consistent naming format
5. Continue running and monitoring for new files

### Execute Mode

Performs a one-time scan and organization of all existing files:

```bash
node main.js --mode execute
```

In execute mode, chiprr will:

1. Recursively scan the entire input directory for video files
2. Process each video file found using the same logic as watch mode
3. Report the number of successful and failed operations
4. Exit once all files have been processed

This mode is useful for:

- Initial organization of an existing library
- Periodic cleanup runs (e.g., via cron job)
- Processing files that were added while chiprr was not running

### Example

Input file:

```
/downloads/Breaking.Bad.S01E03.720p.BluRay.x264-DEMAND.mkv
```

Output structure:

```
/sorted/Breaking Bad/Season 1/Breaking Bad S01E03.mkv
```

## Supported File Formats

### Video Extensions

- mp4, avi, mov, wmv, webm, flv, m4v, mkv, vob, ts, 3gp, asf, divx

### Episode Naming Patterns

- `S01E01` - Standard format
- `1x01` - Alternative format
- `Cap.101` - Spanish/Portuguese format (Capitulo)
- `E01`, `Ep01` - Episode only format

## Ignoring Files with .chiprrignore

chiprr supports `.chiprrignore` files to exclude unwanted files and directories from processing. This feature uses gitignore syntax and works hierarchically.

### How It Works

Place a `.chiprrignore` file in any directory within your input directory. The ignore rules will apply to that directory and all its subdirectories.

### Empty .chiprrignore File

An **empty** `.chiprrignore` file will ignore **all files** in that directory and its subdirectories:

```bash
# Create an empty .chiprrignore to ignore everything in this directory
touch /downloads/unwanted-show/.chiprrignore
```

### Pattern-Based Ignoring

A **non-empty** `.chiprrignore` file uses gitignore syntax to selectively ignore files:

```gitignore
# Ignore sample files
*sample*
*SAMPLE*

# Ignore subtitle files
*.srt
*.sub
*.ass

# Ignore NFO and metadata files
*.nfo
*.txt

# But keep important files
!important.txt

# Ignore specific directories
extras/
Extras/
behind.the.scenes/
```

### Example Directory Structure

```
/downloads/
├── .chiprrignore              # Applies to all subdirectories
├── Breaking Bad/
│   ├── Season 1/
│   │   ├── episode1.mkv       # ✓ Processed
│   │   ├── episode1.srt       # ✗ Ignored (if *.srt in .chiprrignore)
│   │   └── sample.mkv         # ✗ Ignored (if *sample* in .chiprrignore)
│   └── extras/                # ✗ Ignored (if extras/ in .chiprrignore)
│       └── interview.mkv
└── unwanted-show/
    ├── .chiprrignore          # Empty file - ignores everything
    └── episode.mkv            # ✗ Ignored (empty .chiprrignore in parent)
```

### Supported Patterns

chiprr uses the [`ignore`](https://github.com/kaelzhang/node-ignore) library, which fully implements gitignore specification:

- `*.log` - Ignore all .log files
- `**/*.tmp` - Ignore .tmp files in any subdirectory
- `!important.txt` - Negation: don't ignore this file
- `folder/` - Ignore entire directory
- `*sample*` - Ignore files containing "sample"
- `# comment` - Comments are ignored

### Hierarchical Rules

Rules from parent directories apply to child directories. You can have multiple `.chiprrignore` files at different levels:

```
/downloads/
├── .chiprrignore              # Global rules (e.g., *.srt)
└── Show Name/
    ├── Season 1/
    │   └── .chiprrignore      # Additional rules for this season
    └── Season 2/
```

## How It Works

1. **File Watching**: Uses chokidar to monitor the input directory for new files
2. **Filename Parsing**: Extracts show name, season, and episode from various naming conventions
3. **Show Matching**: Queries TMDB API to find the correct show name and handles variations
4. **Smart Matching**: Falls back to fuzzy matching and diacritics removal if exact match isn't found
5. **File Organization**: Creates hard links in a clean directory structure without duplicating data
6. **Ignore Filtering**: Checks `.chiprrignore` files to skip unwanted files and directories

## Development

```bash
# Run tests
npm test

# Run in development mode
npm run dev

# Build
npm run build
```

## Requirements

- Node.js 18+
- File system that supports hard links
- TMDB API token
- Write permissions for both input and sorted directories

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
