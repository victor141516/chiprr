# Chiprr Project Context

## Project Overview

**Chiprr** is a TV show file organizer that uses heuristics and the TMDB (The Movie Database) API to intelligently parse video filenames and organize them by show name, season, and episode.

### Core Functionality

1. **Scan** video files from an input directory
2. **Parse** filenames to extract show name, season, and episode information
3. **Match** extracted show names against TMDB database to get canonical names
4. **Organize** files into a structured directory hierarchy using hard links

## Architecture

### Domain Layer

#### Models

- **`EpisodeInfo`**: Core data model containing:
  - `showName: string` - Name of the TV show
  - `season: number` - Season number
  - `episode: number` - Episode number

#### Services

##### VideoFileParser

- **Purpose**: Extract show information from file paths using heuristics
- **Location**: `src/domain/services/VideoFileParser.ts`
- **Key Responsibilities**:
  - Parse file paths into component parts
  - Clean filenames by removing garbage (quality indicators, codec info, etc.)
  - Extract season/episode information using multiple regex patterns
  - Determine show name from filename or parent directories

**Current Implementation Details**:

1. **Path Parsing** (`parsePath()`):
   - Splits full path into array of components (directories + filename)
   - Uses Node.js `path` module for cross-platform compatibility
   - Normalizes paths before parsing

2. **Episode/Season Extraction** (`findEpisodeAndSeason()`):
   - Supports multiple naming patterns:
     - `S01E01`, `S1E1` (standard TV format)
     - `1x01`, `01x01` (alternative format)
     - `Cap.101`, `Capitulo 101` (Spanish format - "Cap" means chapter)
     - `E01`, `Ep01` (episode only)
     - `S03` (season only, used with separate episode indicator)
   - Returns matched strings for later removal from show name
   - Throws error if season/episode cannot be determined

3. **Filename Cleaning** (`cleanFileName()`):
   - **Step 1**: Remove episode/season indicators and everything after them
   - **Step 2**: Remove content in brackets: `[]`, `()`, `{}`, `<>`
   - **Step 3**: Normalize dashes with proper spacing
   - **Step 4**: Replace periods with spaces (if period density > 7%)
   - **Step 5**: Replace underscores with spaces (if underscore density > 7%)
   - **Step 6**: Remove quality/codec indicators: `HDTV`, `720p`, `1080p`, `480p`, `WEB-DL`, `BluRay`, `DVDRip`, `x264`, `x265`, `HEVC`, `AAC`, `AC3`
   - **Step 7**: Normalize whitespace
   - **Step 8**: If filename contains `-`, take only the part before it (assumes it's the title)
   - **Step 9**: Convert to lowercase for consistency

4. **Show Name Determination**:
   - If no parent directories: use cleaned filename
   - If parent directories exist:
     - Try to find longest common substring between directories and filename
     - Prioritize directories closer to the file
     - Use longest candidate if > 3 characters
     - Fallback to filename if no good candidates found

5. **Parent Directories Processing**:
   - Extract and clean parent directories from closest to furthest
   - Only include directories with meaningful names (> 3 characters after cleaning)
   - Return as array for use in ShowMatcher fallback logic

**Known Edge Cases**:

- Spanish language files with "Cap" or "Capitulo" indicators
- Files with year indicators like `(2019)` - removed by bracket cleaning
- Files with release group tags - removed by bracket cleaning
- Files with episode titles - handled by `-` splitting logic
- Anime files with fansub group tags like `[SubsPlease]` - removed by bracket cleaning

##### ShowMatcher

- **Purpose**: Match parsed show names against TMDB database for canonical names
- **Location**: `src/domain/services/ShowMatcher.ts`
- **Key Responsibilities**:
  - Search TMDB for show name matches
  - Handle exact and fuzzy matching (with/without diacritics)
  - Implement fallback strategy using parent directories
  - Return canonical show name from TMDB

**Current Implementation Details**:

1. **Main Matching Flow** (`match()`):
   - Try to match `episodeInfo.showName` first
   - If exact match found, return immediately
   - If no match, iterate through `parentDirectories` from closest to furthest
   - Each directory is tried until a match is found
   - If still no match, use first search result as fallback
   - Throws error if no results found at all

2. **Matching Logic** (`tryMatch()`):
   - **Step 1**: Search TMDB with the provided name
   - **Step 2**: Try exact match (case-insensitive)
   - **Step 3**: Try match without diacritics (café → cafe)
   - Returns `{ foundMatch: boolean, matchedName: string }`

3. **Diacritics Handling**:
   - Uses `removeDiacritics()` utility function
   - Compares both query and API results without diacritics
   - Handles international show names (Spanish, French, etc.)

**Iterative Directory Matching Strategy**:

- Parent directories are ordered from closest to furthest (already done by VideoFileParser)
- Example path: `/media/series/Breaking Bad/Season 01/Breaking.Bad.S01E03.mkv`
  - Try 1: "breaking bad s01e03" (filename) ❌
  - Try 2: "season 01" ❌
  - Try 3: "breaking bad" ✅ MATCH!
- This strategy handles cases where filename is too specific or corrupted

### Infrastructure Layer

#### TMDB Integration

##### TMDBClient

- **Purpose**: Communicate with TMDB API
- **Location**: `src/infrastructure/tmdb/TMDBClient.ts`
- **Key Features**:
  - Search for TV shows by name
  - Fetch language variations for shows
  - Automatic caching of all responses
  - Bearer token authentication

**API Endpoints Used**:

1. **Search TV Shows**: `GET /3/search/tv`
   - Query parameter: show name
   - Returns: array of matching shows with ID and name
   - Used for initial show lookup

2. **Translations**: `GET /3/tv/{show_id}/translations`
   - Returns: array of show name translations in different languages
   - Used for matching international show names

**Response Processing**:

- If exact match found in search results: return immediately (one-item array)
- If no exact match: fetch language variations for all results
- Cache includes all possible names (original + translations)
- All names converted to lowercase for comparison

##### TMDBCache

- **Purpose**: Persist TMDB API responses to avoid repeated API calls
- **Location**: `src/infrastructure/tmdb/TMDBCache.ts`
- **Key Features**:
  - File-based cache using JSON
  - Debounced writes (1 second delay)
  - Automatic directory creation
  - Graceful error handling

**Cache Structure**:

```json
{
  "breaking bad": [
    {
      "id": 1396,
      "name": "Breaking Bad",
      "names": ["breaking bad", "брејкинг бед", "breaking bad - felina", ...]
    }
  ],
  "game of thrones": [...]
}
```

**Cache Behavior**:

- **Key**: Lowercase search query
- **Value**: Array of `CachedShow` objects
- **Location**: `.cache/tmdb-cache.json` (configurable)
- **Persistence**: Automatic with 1-second debounce
- **Loading**: Synchronous on instantiation

**Design Decisions**:

- Debouncing prevents excessive disk writes during batch operations
- Map<string, CachedShow[]> structure allows O(1) lookups
- File-based cache enables sharing between runs and developers
- Graceful fallback (empty cache) if file is corrupted

#### Filesystem Operations

##### DirectoryScanner

- **Purpose**: Recursively scan directories for video files
- Filters for video extensions

##### FileWatcher

- **Purpose**: Watch for new files and trigger organization
- Uses `chokidar` for cross-platform file watching

##### HardLinkCreator

- **Purpose**: Create hard links instead of copying files
- Preserves disk space while creating organized structure

#### Logging

##### Logger

- **Purpose**: Structured logging with Winston
- **Location**: `src/infrastructure/logging/Logger.ts`
- Supports multiple log levels (debug, info, warn, error)
- Used throughout the application for debugging

## Key Patterns and Heuristics

### Episode/Season Number Extraction

Patterns are tried in order, first match wins:

1. **Standard Format**: `S01E01`, `S1E1`
   - Regex: `/[Ss](?<season>\d{1,2})[Ee](?<episode>\d{1,3})/`
   - Most common format in English-speaking countries
   - Works with variable digit counts

2. **Alternative Format**: `1x01`, `01x01`
   - Regex: `/(?<season>\d{1,2})x(?<episode>\d{1,3})/i`
   - Common in European releases
   - Case-insensitive

3. **Spanish Cap Format (Combined)**: `Cap.101`, `Capitulo102`
   - Regex: `/(?:cap(?:itulo)?\.?\s*)(?<season>\d{1,2})(?<episode>\d{2})/i`
   - First digit(s) = season, last 2 digits = episode
   - Example: `Cap.405` = Season 4, Episode 5

4. **Spanish Cap Format (Episode Only)**: `Cap.5`, `Capitulo 12`
   - Regex: `/(?:cap(?:itulo)?\.?\s*)(?<episode>\d{1,2})/i`
   - Used when season is in directory name
   - Assumes season 1 if not found elsewhere

5. **Episode Only Format**: `E01`, `Ep01`, `Episode 5`
   - Regex: `/(?:e|ep|episode)\.?\s*(?<episode>\d{1,3})/i`
   - Requires season from directory or other context

6. **Season Only Format**: `S03`
   - Regex: `/(?:s)(?<season>\d{1,2})/i`
   - Used with separate episode indicator (e.g., `One Punch Man S03 - E01`)

### Show Name Cleaning

**Removal Patterns**:

- **Brackets**: `[]`, `()`, `{}`, `<>` and their contents
  - Example: `[HDTV 720p]`, `(US)`, `{AC3}` → removed
- **Separators**: Periods and underscores (if density > 7%)
  - `Breaking.Bad.S01E01.mkv` → `Breaking Bad S01E01`
  - `The_Office_US_S02E03.mp4` → `The Office US S02E03`
- **Quality Indicators**:
  - Video: `HDTV`, `720p`, `1080p`, `480p`, `2160p`, `4K`, `BluRay`, `DVDRip`, `WEB-DL`
  - Codec: `x264`, `x265`, `HEVC`, `H.264`, `H.265`
  - Audio: `AAC`, `AC3`, `DD5.1`, `DDP5.1`, `Atmos`
  - Source: `WEBRip`, `NF`, `AMZN`, `DSNP`
- **Release Groups**: Content in brackets usually contains these
  - Example: `[www.torrentrapid.com]`, `[rartv]`, `NTb`, `DEMAND`

**Normalization**:

- Trim leading/trailing dashes and periods
- Normalize whitespace to single spaces
- Convert to lowercase for comparison
- Handle `Title - Episode Name` format by taking only the title

### Directory vs Filename Prioritization

**Strategy 1: Perfect Match**

- If directory name contains entire cleaned filename
- Use longest common substring
- Example: Directory `Breaking Bad` contains filename `Breaking Bad S01E01` → Use "Breaking Bad"

**Strategy 2: Partial Match**

- Find longest common substring between directory and filename
- Requires minimum length > 3 characters
- Example: Directory `Game of Thrones` + Filename `GoT.S01E01` → Common substring might be minimal, prefer directory

**Strategy 3: Filename Fallback**

- If no meaningful directory matches found
- Use cleaned filename as show name
- Example: Single file `Breaking Bad S01E01.mkv` → Use "Breaking Bad"

## Testing Strategy

### Current Test Coverage

#### VideoFileParser Tests

- **Location**: `src/domain/services/VideoFileParser.test.ts`
- **Test Cases**: 32+ diverse filenames
- **Coverage**:
  - Various naming patterns (S01E01, 1x01, Cap.101)
  - Different quality indicators (720p, 1080p, HDTV, BluRay)
  - Multiple languages (English, Spanish)
  - With/without directory structure
  - Edge cases (special characters, year indicators, release groups)

**Test Pattern**:

```typescript
for (const { filePath, result } of testCases) {
  it(`should return: ${JSON.stringify(result)}`, () => {
    const parsed = parser.parse(filePath);
    expect({
      showName: parsed.showName,
      season: parsed.season,
      episode: parsed.episode,
    }).toEqual(result);
    expect(parsed).toHaveProperty("parentDirectories");
    expect(Array.isArray(parsed.parentDirectories)).toBe(true);
  });
}
```

#### ShowMatcher Tests

- **Status**: Currently missing (to be implemented)
- **Planned Coverage**:
  - Use same test cases from VideoFileParser
  - Verify TMDB matching works correctly
  - Test iterative directory fallback
  - Test diacritics handling
  - Test error cases

### Test Infrastructure

**Current Setup**:

- Framework: Vitest
- Logger: Winston with error level during tests (suppress debug output)
- Environment: Minimal environment variables set

**Planned Improvements**:

1. Add TMDB cache for tests
2. Track cache file in repository
3. Configure environment variables in package.json
4. Allow tests to run without API key (using cache)

## Dependencies

### External Libraries

- **`winston`**: Logging framework
- **`chokidar`**: File system watcher
- **`yargs`**: CLI argument parsing
- **`string-algorithms`**: Longest common substring calculation
- **`vitest`**: Testing framework

### APIs

- **TMDB API v3**: TV show database
  - Requires API token (Bearer authentication)
  - Rate limits apply
  - Free tier available

## Configuration

### Environment Variables

- `TMDB_TOKEN`: API token for TMDB (required for API calls)
- `INPUT_DIRECTORY`: Directory to scan for video files
- `SORTED_DIRECTORY`: Directory to organize files into
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)

### Current Configuration Issues

- Test script sets environment variables but leaves some empty
- No default cache path configuration
- API token required even when cache could be used

## Common File Naming Patterns

Based on test cases, these patterns are commonly found:

### Pattern 1: Simple Format

`ShowName S01E01.extension`

- Example: `Breaking Bad S01E01.mkv`

### Pattern 2: With Quality

`ShowName S01E01 [Resolution].extension`

- Example: `Game of Thrones 1x05 [1080p].mp4`

### Pattern 3: With Episode Title

`ShowName - S01E01 - Episode Title Quality.extension`

- Example: `The Office (US) - S02E10 - Christmas Party.avi`

### Pattern 4: Release Group Format

`ShowName.S01E01.Quality.Codec-Group.extension`

- Example: `Breaking.Bad.S01E03.720p.BluRay.x264-DEMAND.mkv`

### Pattern 5: Spanish Format

`ShowName [Quality][Cap.101][Audio]/ShowName [Quality][Cap.101].extension`

- Example: `Peaky Blinders - Temporada 1 [HDTV 720p][Cap.105][AC3 5.1]/PB 1x05 720p.mkv`

### Pattern 6: Anime Format

`[FansubGroup] Show Name - S01E01 (Resolution) [Hash].extension`

- Example: `[SubsPlease] Attack on Titan - S04E28 (1080p) [A1B2C3D4].mkv`

## Known Issues and Limitations

### Issue 1: Ambiguous Filenames

When filename doesn't contain show name clearly:

- Example: `PB 1x05 720p.mkv` could be "Peaky Blinders" or "Prison Break"
- **Mitigation**: Rely on parent directory names
- **Current Behavior**: May extract incorrect show name from filename

### Issue 2: Multi-Episode Files

Files containing multiple episodes not explicitly handled:

- Example: `Show.S01E01-E02.mkv`
- **Current Behavior**: Likely only captures first episode

### Issue 3: Year Ambiguity

Years in show names removed by bracket cleaning:

- Example: `The Witcher (2019)` → `The Witcher`
- **Impact**: If multiple shows with same name exist, wrong one might be matched
- **TMDB Mitigation**: API returns results by popularity, usually correct

### Issue 4: Special Episodes

Special episodes, OVAs, or movies not handled:

- Example: `Show S00E01 Special.mkv`
- **Current Behavior**: Season 0 accepted but may not match TMDB metadata properly

### Issue 5: Cache Invalidation

No cache invalidation strategy:

- If TMDB data changes (show renamed), cache becomes stale
- **Mitigation**: Manual cache clearing required

## Future Enhancement Opportunities

Based on current analysis:

1. **PathElement Extraction** (Planned)
   - Parse each directory individually for episode info
   - Better handling of complex directory structures
   - More robust matching heuristics

2. **Confidence Scoring**
   - Assign confidence scores to matches
   - Allow user review of low-confidence matches
   - Log warnings for ambiguous cases

3. **Multi-Episode Support**
   - Detect E01-E02 or E01E02 patterns
   - Handle batch file organization

4. **Custom Patterns**
   - Allow users to define custom regex patterns
   - Support site-specific or tracker-specific formats

5. **Cache Management UI**
   - View cache contents
   - Manually add/remove/edit entries
   - Export/import cache

6. **Better Year Handling**
   - Preserve year information if in parentheses
   - Use year for disambiguation in TMDB matching

7. **Progress Tracking**
   - Show progress during batch operations
   - Resume interrupted operations

## Glossary

- **TMDB**: The Movie Database - Open API for movie/TV metadata
- **Heuristic**: Rule-based approach to problem-solving (vs ML/AI)
- **Hard Link**: Filesystem reference to same inode (saves space vs copying)
- **Diacritics**: Accents and special characters (é, ñ, ü, etc.)
- **Resolution**: Video quality (480p, 720p, 1080p, 2160p/4K)
- **Codec**: Video compression format (x264, x265/HEVC, H.264)
- **Release Group**: Group that released the file (scene groups, P2P groups)
- **Fansub**: Fan-made subtitles, common in anime releases

## References

- TMDB API Documentation: https://developers.themoviedb.org/3
- Node.js Path Module: https://nodejs.org/api/path.html
- Vitest Documentation: https://vitest.dev/
- Winston Logger: https://github.com/winstonjs/winston
