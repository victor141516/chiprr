import { describe, expect, it } from "vitest";
import {
  collectPathEvidence,
  groupCorroboratedTitles,
} from "./MediaPathEvidence";

describe("shared media path evidence", () => {
  it("returns file and parents closest-first without escaping the input root", () => {
    expect(
      collectPathEvidence(
        "/data/downloads/completed/Movies/Dune (2021)/Dune.mkv",
        "/data/downloads/completed/Movies",
      ),
    ).toEqual([
      { name: "Dune.mkv", source: "file", distance: 0 },
      { name: "Dune (2021)", source: "directory", distance: 1 },
    ]);
  });

  it("ranks a title corroborated by file and parent ahead of unsupported noise", () => {
    const candidates = [
      { title: "release group", source: "file" },
      { title: "Dune", source: "file" },
      { title: "Dune", source: "directory" },
    ];

    const groups = groupCorroboratedTitles(candidates, ({ title }) => title);

    expect(groups.map(({ normalizedTitle, support }) => ({ normalizedTitle, support }))).toEqual([
      { normalizedTitle: "dune", support: 2 },
      { normalizedTitle: "release group", support: 1 },
    ]);
  });
});
