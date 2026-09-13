import { describe, expect, it, vi } from "vitest";
import {
  buildTitleSearchVariants,
  matchTitleVariants,
} from "./TitleMatchPipeline";

describe("shared title match pipeline", () => {
  it("removes parenthetical groups cumulatively and preserves them as evidence", () => {
    expect(
      buildTitleSearchVariants("Movie (Edition) (Studio)"),
    ).toEqual([
      { title: "Movie (Edition) (Studio)", evidence: [] },
      { title: "Movie (Edition)", evidence: ["Studio"] },
      { title: "Movie", evidence: ["Studio", "Edition"] },
    ]);
  });

  it("uses exact TMDB evidence only when it leaves one candidate", async () => {
    const first = { id: 1, names: ["la odisea"] };
    const asylum = { id: 2, names: ["la odisea"] };
    const search = vi.fn(async (query: string) =>
      query === "La odisea" ? [first, asylum] : [],
    );
    const loadEvidence = vi.fn(async ({ id }: { id: number }) =>
      id === 2 ? ["The Asylum", "US"] : ["Syncopy", "US"],
    );

    await expect(
      matchTitleVariants({
        title: "La odisea (The Asylum)",
        search,
        loadEvidence,
      }),
    ).resolves.toMatchObject({ match: asylum });
    expect(search).toHaveBeenNthCalledWith(1, "La odisea (The Asylum)");
    expect(search).toHaveBeenNthCalledWith(2, "La odisea");
  });

  it("does not choose when independent clues point to different candidates", async () => {
    const first = { id: 1, names: ["shared"] };
    const second = { id: 2, names: ["shared"] };

    const result = await matchTitleVariants({
      title: "Shared (First) (Second)",
      search: async (query) => (query === "Shared" ? [first, second] : []),
      loadEvidence: async ({ id }) => (id === 1 ? ["First"] : ["Second"]),
    });

    expect(result.match).toBeUndefined();
    expect(result.ambiguous).toBe(true);
  });
});
