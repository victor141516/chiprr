import { normalizeEvidenceTitle } from "./MediaPathEvidence";

export interface SearchableTitle {
  id: number;
  names: string[];
}

export interface TitleSearchVariant {
  title: string;
  evidence: string[];
}

export interface TitleMatchResult<T> {
  match?: T;
  fallback?: T;
  ambiguous: boolean;
  attemptedTitles: string[];
}

function cleanVariant(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:])/g, "$1")
    .replace(/^[\s,;:_-]+|[\s,;:_-]+$/g, "")
    .trim();
}

/**
 * Keeps the complete title first, then removes balanced parenthetical groups
 * cumulatively from right to left. Removed values remain available as
 * disambiguation evidence instead of being discarded.
 */
export function buildTitleSearchVariants(title: string): TitleSearchVariant[] {
  const original = cleanVariant(title);
  if (!original) {
    return [];
  }

  const groups = [...original.matchAll(/\(([^()]*)\)/g)].filter(
    (match) => match.index !== undefined && match[1]?.trim(),
  );
  const variants: TitleSearchVariant[] = [
    { title: original, evidence: [] },
  ];
  const removedEvidence: string[] = [];
  let working = original;

  for (const group of groups.reverse()) {
    const start = group.index!;
    const end = start + group[0].length;
    removedEvidence.push(group[1]!.trim());
    working = cleanVariant(`${working.slice(0, start)} ${working.slice(end)}`);
    if (!working) {
      continue;
    }
    variants.push({ title: working, evidence: [...removedEvidence] });
  }

  const seen = new Set<string>();
  return variants.filter(({ title: variantTitle }) => {
    const normalized = normalizeEvidenceTitle(variantTitle);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

async function uniqueEvidenceMatch<T extends SearchableTitle>(
  candidates: T[],
  evidence: string[],
  loadEvidence: (candidate: T) => Promise<string[]>,
): Promise<T | undefined> {
  const clues = [
    ...new Set(evidence.map(normalizeEvidenceTitle).filter(Boolean)),
  ];
  if (candidates.length < 2 || clues.length === 0) {
    return undefined;
  }

  const candidateEvidence = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      values: new Set(
        [...candidate.names, ...(await loadEvidence(candidate))]
          .map(normalizeEvidenceTitle)
          .filter(Boolean),
      ),
    })),
  );

  const informativeMatches = clues
    .map((clue) =>
      candidateEvidence
        .filter(({ values }) => values.has(clue))
        .map(({ candidate }) => candidate.id),
    )
    .filter((matches) => matches.length > 0);
  if (informativeMatches.length === 0) {
    return undefined;
  }

  const survivingIds = informativeMatches.slice(1).reduce(
    (survivors, matches) =>
      new Set([...survivors].filter((id) => matches.includes(id))),
    new Set(informativeMatches[0]),
  );
  if (survivingIds.size !== 1) {
    return undefined;
  }

  const id = [...survivingIds][0];
  return candidates.find((candidate) => candidate.id === id);
}

/**
 * Shared exact-title matching pipeline for movies and shows. Media-specific
 * callers can refine ambiguous candidates first (for example by release
 * year), while parenthetical evidence is resolved consistently afterwards.
 */
export async function matchTitleVariants<T extends SearchableTitle>({
  title,
  search,
  refineAmbiguous = (candidates) => candidates,
  loadEvidence,
}: {
  title: string | string[];
  search: (query: string) => Promise<T[]>;
  refineAmbiguous?: (candidates: T[]) => T[];
  loadEvidence?: (candidate: T) => Promise<string[]>;
}): Promise<TitleMatchResult<T>> {
  let fallback: T | undefined;
  let ambiguous = false;
  const attemptedTitles: string[] = [];
  const sourceTitles = (Array.isArray(title) ? title : [title])
    .map((value, index) => ({
      value,
      index,
      parentheticalGroups: [...value.matchAll(/\(([^()]*)\)/g)].length,
    }))
    .sort(
      (left, right) =>
        right.parentheticalGroups - left.parentheticalGroups ||
        left.index - right.index,
    );
  const seenQueries = new Set<string>();
  const variants = sourceTitles
    .flatMap(({ value }) => buildTitleSearchVariants(value))
    .filter(({ title: query }) => {
      const key = query.toLocaleLowerCase();
      if (seenQueries.has(key)) {
        return false;
      }
      seenQueries.add(key);
      return true;
    });

  for (const variant of variants) {
    attemptedTitles.push(variant.title);
    const searchResult = await search(variant.title);
    fallback ??= searchResult[0];
    const normalizedTitle = normalizeEvidenceTitle(variant.title);
    const exactMatches = searchResult.filter((candidate) =>
      candidate.names.some(
        (name) => normalizeEvidenceTitle(name) === normalizedTitle,
      ),
    );

    if (exactMatches.length === 1) {
      return { match: exactMatches[0], fallback, ambiguous, attemptedTitles };
    }
    if (exactMatches.length === 0) {
      continue;
    }

    const refined = refineAmbiguous(exactMatches);
    if (refined.length === 1) {
      return { match: refined[0], fallback, ambiguous, attemptedTitles };
    }

    ambiguous = true;
    if (refined.length > 1 && variant.evidence.length > 0 && loadEvidence) {
      const evidenceMatch = await uniqueEvidenceMatch(
        refined,
        variant.evidence,
        loadEvidence,
      );
      if (evidenceMatch) {
        return {
          match: evidenceMatch,
          fallback,
          ambiguous,
          attemptedTitles,
        };
      }
    }
  }

  return { fallback, ambiguous, attemptedTitles };
}
