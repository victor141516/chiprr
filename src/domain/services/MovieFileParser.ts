import * as path from "path";
import { collectPathEvidence } from "./MediaPathEvidence";

export interface MovieCandidate {
  title: string;
  year: number | null;
  titleWithYearToken?: string;
  source: "file" | "directory";
  sourceName: string;
}

const GENERIC_DIRECTORY_NAMES = new Set([
  "completed",
  "downloads",
  "download",
  "movie",
  "movies",
  "video",
  "videos",
]);

const RELEASE_MARKER =
  /\b(?:2160p|1080p|720p|576p|480p|360p|240p|4k|uhd|hdr10\+?|hdr|dv|dolby[ ._-]?vision|web[ ._-]?(?:dl|rip)|blu[ ._-]?ray|b[dr]rip|dvd[ ._-]?rip|hdtv|remux|repack|proper|extended|unrated|director'?s[ ._-]?cut|multi|dual|x26[45]|h[ ._-]?26[45]|hevc|av1|vp9|aac|ac3|eac3|ddp?\d?(?:\.\d)?|dts(?:[ ._-]?hd)?|truehd|atmos)\b/i;

const YEAR_PATTERN =
  /(?:^|[\s._([{])(?<year>(?:18|19|20)\d{2})(?=$|[\s._)\]}])/g;

/**
 * Extracts movie title candidates from the filename first, then from parent
 * directories from closest to furthest.
 */
export class MovieFileParser {
  private inputDirectory?: string;

  constructor({ inputDirectory }: { inputDirectory?: string } = {}) {
    this.inputDirectory = inputDirectory
      ? path.resolve(inputDirectory)
      : undefined;
  }

  parse(filePath: string): MovieCandidate[] {
    const orderedElements = collectPathEvidence(filePath, this.inputDirectory);
    const candidates: MovieCandidate[] = [];

    for (const element of orderedElements) {
      const candidate = this.parseElement(element.name, element.source);
      if (!candidate) {
        continue;
      }

      if (
        candidate.source === "directory" &&
        GENERIC_DIRECTORY_NAMES.has(candidate.title.toLowerCase())
      ) {
        continue;
      }

      candidates.push(candidate);
    }

    return candidates;
  }

  private parseElement(
    pathElement: string,
    source: "file" | "directory",
  ): MovieCandidate | null {
    const withoutExtension =
      source === "file" ? path.parse(pathElement).name : pathElement;
    const yearMatches = [...withoutExtension.matchAll(YEAR_PATTERN)];
    // A leading number such as "2001" or "1917" can be the movie title.
    // Prefer the final year that appears after at least part of the title.
    const yearMatch = yearMatches.findLast((match) => (match.index ?? 0) > 0);
    const year = yearMatch?.groups?.year
      ? Number.parseInt(yearMatch.groups.year, 10)
      : null;

    let title = withoutExtension
      .replace(/\[[^\]]*]/g, " ")
      .replace(/\([^)]*\)/g, (match) =>
        year !== null && match.includes(String(year)) ? " " : match,
      )
      .replace(/\{[^}]*}/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/[._]+/g, " ");

    if (yearMatch?.groups?.year) {
      title = title.replace(
        new RegExp(`\\b${yearMatch.groups.year}\\b`, "g"),
        " ",
      );
    }

    const releaseMarker = title.match(RELEASE_MARKER);
    if (releaseMarker?.index !== undefined) {
      title = title.slice(0, releaseMarker.index);
    }

    title = title
      .replace(/\s+-\s+[A-Z0-9][A-Z0-9._-]{1,}$/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s.,_-]+|[\s.,_-]+$/g, "")
      .trim();

    if (title.length < 2) {
      return null;
    }

    return {
      title,
      year,
      titleWithYearToken: year === null ? undefined : `${title} ${year}`,
      source,
      sourceName: pathElement,
    };
  }

}
