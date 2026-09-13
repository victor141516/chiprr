import path from "path";
import type { MatchedMedia } from "../models/MatchedMedia";

const WINDOWS_RESERVED_NAME =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

/**
 * Chiprr's canonical, cross-platform title sanitization contract.
 *
 * - Control characters are removed.
 * - Path separators and colons become a spaced dash.
 * - Other Windows-invalid filename characters become spaces.
 * - Whitespace is collapsed and trailing dots/spaces are removed.
 * - Windows device names receive a trailing underscore.
 */
export function sanitizePathSegment(value: string): string {
  let result = value
    .replace(/[\u0000-\u001f\u0080-\u009f]/g, " ")
    .replace(/[:/\\]+/g, " - ")
    .replace(/[<>"|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  if (WINDOWS_RESERVED_NAME.test(result)) {
    result = `${result}_`;
  }

  if (result === "" || result === "." || result === "..") {
    throw new Error(
      `Media title cannot be represented as a filename: ${value}`,
    );
  }

  return result;
}

export function buildDestinationPath({
  sortedDirectory,
  originalPath,
  media,
}: {
  sortedDirectory: string;
  originalPath: string;
  media: MatchedMedia;
}): string {
  const extension = path.extname(originalPath);
  if (extension === "") {
    throw new Error(`Video file has no extension: ${originalPath}`);
  }

  if (media.kind === "movie") {
    const title = sanitizePathSegment(media.title);
    const fileName = `${title}${media.year === null ? "" : ` (${media.year})`}${extension}`;
    return path.join(sortedDirectory, fileName);
  }

  const showName = sanitizePathSegment(media.showName);
  const season = media.season.toString().padStart(2, "0");
  const episode = media.episode.toString().padStart(2, "0");
  return path.join(
    sortedDirectory,
    showName,
    `Season ${media.season}`,
    `${showName} S${season}E${episode}${extension}`,
  );
}
