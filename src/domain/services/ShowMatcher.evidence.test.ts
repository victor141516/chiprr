import { describe, expect, it, vi } from "vitest";
import { Logger } from "../../infrastructure/logging/Logger";
import { ShowMatcher, type ShowSearchClient } from "./ShowMatcher";
import type { ParsedPathElement } from "./VideoFileParser";

describe("ShowMatcher path evidence", () => {
  it("uses the same parenthetical evidence pipeline for shows", async () => {
    const uk = { id: 1, name: "The Office UK", names: ["the office"] };
    const us = { id: 2, name: "The Office", names: ["the office"] };
    const searchShow = vi.fn(async (query: string) =>
      query === "the office" ? [uk, us] : [],
    );
    const getShowEvidence = vi.fn(async (id: number) =>
      id === us.id ? ["US", "NBC"] : ["GB", "BBC Two"],
    );
    const matcher = new ShowMatcher({
      tmdbClient: { searchShow, getShowEvidence },
      logger: new Logger({ logLevel: "error", name: "ShowMatcherEvidenceTest" }),
    });

    await expect(
      matcher.match([
        {
          bestEffortShowName: "the office (us)",
          season: 2,
          episode: 3,
          type: "file",
        },
      ]),
    ).resolves.toEqual({
      kind: "show",
      showName: "The Office",
      season: 2,
      episode: 3,
    });
    expect(getShowEvidence).toHaveBeenCalledWith(us.id);
  });

  it("tries a title corroborated by the file and a parent before a closer noisy directory", async () => {
    const searchShow = vi.fn().mockResolvedValueOnce([
      {
        id: 1,
        name: "Breaking Bad",
        names: ["breaking bad"],
      },
    ]);
    const matcher = new ShowMatcher({
      tmdbClient: { searchShow } as ShowSearchClient,
      logger: new Logger({ logLevel: "error", name: "ShowMatcherEvidenceTest" }),
    });
    const elements: ParsedPathElement[] = [
      {
        bestEffortShowName: "breaking bad",
        season: null,
        episode: null,
        type: "directory",
      },
      {
        bestEffortShowName: "season files",
        season: null,
        episode: null,
        type: "directory",
      },
      {
        bestEffortShowName: "breaking bad",
        season: 1,
        episode: 2,
        type: "file",
      },
    ];

    await expect(matcher.match(elements)).resolves.toEqual({
      kind: "show",
      showName: "Breaking Bad",
      season: 1,
      episode: 2,
    });
    expect(searchShow).toHaveBeenCalledTimes(1);
    expect(searchShow).toHaveBeenCalledWith("breaking bad");
  });
});
