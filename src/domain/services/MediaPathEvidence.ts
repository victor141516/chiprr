import path from "path";
import { removeDiacritics } from "../../utils/stringUtils";

export interface PathElementEvidence {
  name: string;
  source: "file" | "directory";
  distance: number;
}

export interface CorroboratedTitleGroup<T> {
  normalizedTitle: string;
  items: T[];
  support: number;
  firstIndex: number;
}

/**
 * Returns the file first and then its parents from closest to furthest. When
 * an input root is configured, infrastructure ancestors outside it are never
 * exposed as media evidence.
 */
export function collectPathEvidence(
  inputPath: string,
  inputDirectory?: string,
): PathElementEvidence[] {
  const resolvedPath = path.resolve(inputPath);
  let elements: string[];

  if (inputDirectory) {
    const resolvedInputDirectory = path.resolve(inputDirectory);
    const relativePath = path.relative(resolvedInputDirectory, resolvedPath);
    const isOutsideInputDirectory =
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath);
    const boundedPath = isOutsideInputDirectory
      ? path.basename(resolvedPath)
      : relativePath;
    elements = path
      .normalize(boundedPath)
      .split(path.sep)
      .filter((element) => element && element !== ".");
  } else {
    elements = [];
    let currentPath = path.normalize(inputPath);
    do {
      const parsed = path.parse(currentPath);
      if (parsed.base && parsed.base !== ".") {
        elements.unshift(parsed.base);
      }
      currentPath = parsed.dir;
    } while (currentPath && currentPath !== path.parse(currentPath).root);
  }

  const fileName = elements.at(-1);
  if (!fileName) {
    return [];
  }

  return [
    { name: fileName, source: "file", distance: 0 },
    ...elements
      .slice(0, -1)
      .reverse()
      .map((name, index) => ({
        name,
        source: "directory" as const,
        distance: index + 1,
      })),
  ];
}

export function normalizeEvidenceTitle(value: string): string {
  return removeDiacritics(value.trim().toLocaleLowerCase())
    .replace(/['’`]/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Groups equivalent titles from independent path elements. More corroborated
 * groups are tried first; ties retain file/nearest-parent order.
 */
export function groupCorroboratedTitles<T>(
  items: T[],
  titleOf: (item: T) => string,
): CorroboratedTitleGroup<T>[] {
  const groups = new Map<string, CorroboratedTitleGroup<T>>();

  items.forEach((item, index) => {
    const normalizedTitle = normalizeEvidenceTitle(titleOf(item));
    if (!normalizedTitle) {
      return;
    }
    const existing = groups.get(normalizedTitle);
    if (existing) {
      existing.items.push(item);
      existing.support = existing.items.length;
      return;
    }
    groups.set(normalizedTitle, {
      normalizedTitle,
      items: [item],
      support: 1,
      firstIndex: index,
    });
  });

  return [...groups.values()].sort(
    (left, right) =>
      right.support - left.support || left.firstIndex - right.firstIndex,
  );
}
