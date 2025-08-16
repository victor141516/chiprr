import * as path from "path";
import { longestCommonSubstring } from "string-algorithms";

export interface EpisodeInfo {
  showName: string;
  season: number;
  episode: number;
}

function parsePath(inputPath: string) {
  const parts = [];
  let currentPath = inputPath;

  // Normalizar el path
  currentPath = path.normalize(currentPath);

  do {
    const parsed = path.parse(currentPath);

    // Agregar la parte actual (archivo o directorio)
    if (parsed.base && parsed.base !== ".") {
      parts.unshift(parsed.base);
    }

    // Continuar con el directorio padre
    currentPath = parsed.dir;
  } while (currentPath && currentPath !== path.parse(currentPath).root);

  return parts;
}

function cleanFileName(fileName: string, episodeMatchedText: string) {
  let showName = fileName;

  const episodeIndicatorPosition = fileName.indexOf(episodeMatchedText);
  // console.debug("episodeIndicatorPosition :", episodeIndicatorPosition);
  if (episodeIndicatorPosition > 4) {
    // Trying to guess if the episode indicator is NOT at the beginning of the filename
    showName = fileName
      .slice(0, episodeIndicatorPosition)
      // If we remove the indicator from `Bla [S01E01]` we have `Bla [` so let's remove the bracket
      .replace(/[\(\[\<]$/g, "");
  }

  // Remove everything in brackets
  showName = showName
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^\]]*\)/g, "")
    .replace(/\{[^\]]*\}/g, "")
    .replace(/\<[^\]]*\>/g, "");

  // In case something forgets a whitespace before/after a dash
  showName = showName.replace(/(\w)\s*-\s*(\w)/g, "$1 - $2");

  const periods = (fileName.match(/\./g) || []).length;
  if (periods / fileName.length > 0.07) {
    // Some filenames use periods instead of spaces (e.g. `Breaking.Bad.S01E03.720p.BluRay.x264-DEMAND.mkv`)
    // In this case let's replace them with spaces
    // console.debug("Removing periods");
    showName = showName.replace(/\./g, " ");
  }

  const underscores = (fileName.match(/\_/g) || []).length;
  if (underscores / fileName.length > 0.07) {
    // same for underscores
    // console.debug("Removing underscores");
    showName = showName.replace(/\_/g, " ");
  }

  // Remover patrones de calidad/formato comunes
  showName = showName.replace(
    /\b(?:HDTV|720p|1080p|480p|WEB-DL|BluRay|DVDRip|x264|x265|HEVC|AAC|AC3)\b/gi,
    ""
  );

  showName = showName.replace(/\s+/g, " ").trim();

  if (showName.includes(" - ")) {
    const maybeShowName = showName.split(" - ")[0]!;
    if (maybeShowName.match(/^(?:[^\s]\s?)+$/)) {
      showName = maybeShowName;
    }
  }

  return showName.toLowerCase();
}

function trimGarbage(fileName: string) {
  let input = fileName;
  let result = "";

  while (result !== input) {
    input = result;
    result = fileName
      .trim()
      .replace(/^[\-\.]/g, "")
      .replace(/[\-\.]$/g, "")
      .trim();
  }

  return result;
}

// Patrones para detectar temporada y episodio
const patterns = [
  // S01E01, S1E1, etc.
  /[Ss](\d{1,2})[Ee](\d{1,3})/,
  // 1x01, 01x01, etc.
  /(\d{1,2})x(\d{1,3})/i,
  // Cap.101, Cap101, Capitulo.101, etc.
  /(?:cap(?:itulo)?\.?\s*)(\d{3})/i,
  // Episodio directo como E01, Ep01, etc.
  /(?:e|ep|episode)\.?\s*(\d{1,3})/i,
];

function findEpisodeAndSeason(fileName: string) {
  let matchedString!: string;
  let matchFound = false;
  let season!: number;
  let episode!: number;

  // Buscar patrones de temporada y episodio
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      matchedString = match[0]!;

      matchFound = true;

      if (pattern.source.includes("cap(?:itulo)?")) {
        const episodeNumber = Number.parseInt(match[1]!);
        if (episodeNumber > 100) {
          season = Math.floor(episodeNumber / 100);
          episode = episodeNumber % 100;
        } else {
          season = 1;
          episode = episodeNumber;
        }
      } else if (match.length === 3) {
        season = Number.parseInt(match[1]!);
        episode = Number.parseInt(match[2]!);
      } else if (match.length === 2) {
        season = 1;
        episode = Number.parseInt(match[1]!);
      }
      break;
    }
  }

  if (!matchFound) {
    throw new Error(
      "Could not find season/episode information in file name: " + fileName
    );
  }

  return {
    matchedString,
    season,
    episode,
  };
}

export function parseVideoFileName(filePath: string): EpisodeInfo {
  const parsedPath = parsePath(filePath);
  const fileName = parsedPath.at(-1)!;
  const firstParentDir = parsedPath.at(-2);

  const { matchedString, season, episode } = findEpisodeAndSeason(fileName);

  // Remove extension
  const initialCleanFilename = fileName
    .replace(/\.[a-zA-Z0-9]{2,10}$/, "")
    .trim();

  // console.debug("initialCleanFilename :", initialCleanFilename);

  // Process FILENAME to remove garbage
  const fullyCleanFilename = cleanFileName(initialCleanFilename, matchedString);
  // console.debug("fullyCleanFilename :", fullyCleanFilename);
  let showName!: string;

  if (parsedPath.length === 1) {
    // console.debug(
    //   "There are NOT directories in the path --> choosing the file name version"
    // );
    showName = fullyCleanFilename;
  } else {
    // console.debug("There are directories in the path --> trying candidates");
    let candidates: string[] = [];
    // Traverse directories and try to find a good match
    for (const directory of parsedPath.slice(0, -1)) {
      // Process DIRECTORY to remove garbage
      const fullyCleanDir = cleanFileName(directory, matchedString);
      // console.debug("fullyCleanDir :", fullyCleanDir);

      // If one directory completely matches the show name extracted from the filename, then it's surely the good one
      if (fullyCleanDir.includes(fullyCleanFilename)) {
        // console.debug("Perfect match");
        candidates = longestCommonSubstring([
          fullyCleanDir,
          fullyCleanFilename,
        ]);
        break;
      } else {
        // If there is no full intersection, check partial intersections
        const commonSubstrings = longestCommonSubstring([
          fullyCleanDir,
          fullyCleanFilename,
        ]);

        if (commonSubstrings.length > 0) {
          const partialMatch = commonSubstrings[0]!;
          // console.debug("Partial match found:", partialMatch);
          candidates.push(partialMatch);
        } else {
          // console.debug(
          //   "No match at all:",
          //   fullyCleanDir,
          //   "  vs  ",
          //   fullyCleanFilename
          // );
        }
      }
    }

    // console.debug("candidates :", candidates);
    if (candidates.length > 0) {
      const longerCandidate = candidates.sort(
        (a, b) => b.length - a.length
      )[0]!;
      // console.debug("Longer candidate:", longerCandidate);
      if (longerCandidate.length > 3) {
        // Maybe the path is something like `/Downloads/Breaking Bad S03E04.mkv` and we're trying to match `Downloads` with `Breaking Bad...`
        // In this case let's ignore the matching algo and use the filename version
        // console.debug("Partial match is too ");
        showName = longerCandidate;
      } else {
        showName = fullyCleanFilename;
      }
    } else {
      // console.debug("No candidates found --> falling back to filename version");
      console.warn("Not sure about this one:", {
        fileName,
        firstParentDir,
      });
      showName = fullyCleanFilename;
    }
  }

  showName = trimGarbage(showName);

  return {
    showName,
    season,
    episode,
  };
}
