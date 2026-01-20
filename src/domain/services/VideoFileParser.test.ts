import { describe, expect, it } from "vitest";
import { VideoFileParser, type ParsedPathElement } from "./VideoFileParser";
import { Logger } from "../../infrastructure/logging/Logger";

const testCases: Array<{
  filePath: string;
  result: ParsedPathElement[];
}> = [
  {
    filePath:
      "/Downloads/[SubsPlease] Attack on Titan - S04E28 (1080p) [A1B2C3D4].mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "attack on titan",
        episode: 28,
        season: 4,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Downloads/Euphoria.S02E08.All.My.Life.My.Heart.Has.Yearned.for.a.Thing.I.Cannot.Name.1080p.AMZN.WEB-DL.DDP5.1.H.264-TEPES.mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "euphoria",
        episode: 8,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Downloads/Game.of.Thrones.S08E06.The.Iron.Throne.REPACK.1080p.AMZN.WEB-DL.DDP5.1.H.264-GoT.mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "game of thrones",
        episode: 6,
        season: 8,
        type: "file",
      },
    ],
  },
  {
    filePath: "/Downloads/One Punch Man S03 - E01 [Sub] 1080p.mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "one punch man",
        episode: 1,
        season: 3,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Downloads/Peaky Blinders (Proper) - Temporada 1 [HDTV 720p][Cap.105][AC3 5.1 Español Castellano]/PB 1x05 720p [www.newpct1.com].mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "peaky blinders",
        episode: 5,
        season: 1,
        type: "directory",
      },
      {
        bestEffortShowName: "pb 1x05",
        episode: 5,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Downloads/Rick.and.Morty.S04E06.Never.Ricking.Morty.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "rick and morty",
        episode: 6,
        season: 4,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Downloads/The.Boys.S03E08.The.Instant.White-Hot.Wild.1080p.AMZN.WEB-DL.DDP5.1.H.264-CMRG.mkv",
    result: [
      {
        bestEffortShowName: "downloads",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the boys",
        episode: 8,
        season: 3,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Media/Friends/Friends - 2x04 - The One Where Monica Gets a Roommate.avi",
    result: [
      {
        bestEffortShowName: "media",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "friends",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "friends",
        episode: 4,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Media/Ozark/Ozark.S04E14.A.Hard.Way.to.Go.1080p.NF.WEB-DL.DDP5.1.Atmos.HDR.HEVC-TEPES.mkv",
    result: [
      {
        bestEffortShowName: "media",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "ozark",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "ozark",
        episode: 14,
        season: 4,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Media/Peaky Blinders/Peaky.Blinders.S06E07.Lock.and.Key.1080p.iP.WEB-DL.AAC2.0.H.264-NTb.mkv",
    result: [
      {
        bestEffortShowName: "media",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "peaky blinders",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "peaky blinders",
        episode: 7,
        season: 6,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Media/The Witcher (2019)/The.Witcher.2019.S06E02.The.Ends.Beginning.1080p.NF.WEB-DL.DDP5.1.x264-NTG.mkv",
    result: [
      {
        bestEffortShowName: "media",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the witcher",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the witcher 2019",
        episode: 2,
        season: 6,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Series/Casa de Papel/La.Casa.de.Papel.S02E03.720p.NF.WEB-DL.DDP5.1.x264-NTG.mkv",
    result: [
      {
        bestEffortShowName: "series",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "casa de papel",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "la casa de papel",
        episode: 3,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Series/Chernobyl (2019)/Chernobyl.S01E05.Vichnaya.Pamyat.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG.mkv",
    result: [
      {
        bestEffortShowName: "series",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "chernobyl",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "chernobyl",
        episode: 5,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Series/Narcos/Narcos.S03E10.Going.Back.to.Cali.1080p.NF.WEB-DL.DD+5.1.x264-TrollHD.mkv",
    result: [
      {
        bestEffortShowName: "series",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "narcos",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "narcos",
        episode: 10,
        season: 3,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Series/The Office (US)/The.Office.US.S02E15.1080p.WEB-DL.DD5.1.H264-KiNGS.mp4",
    result: [
      {
        bestEffortShowName: "series",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the office",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the office us",
        episode: 15,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Series/Westworld/Westworld.S01E10.The.Bicameral.Mind.1080p.AMZN.WEB-DL.DD+5.1.H.264-CasStudio.mkv",
    result: [
      {
        bestEffortShowName: "series",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "westworld",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "westworld",
        episode: 10,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/TV Shows/Breaking Bad/Season 1/Breaking.Bad.S01E05.720p.HDTV.x264-CTU.mkv",
    result: [
      {
        bestEffortShowName: "tv shows",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "breaking bad",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "season 1",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "breaking bad",
        episode: 5,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/TV Shows/House of Cards/House.of.Cards.US.S01E01.720p.NF.WEBRip.DD5.1.x264-NTb.mkv",
    result: [
      {
        bestEffortShowName: "tv shows",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "house of cards",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "house of cards us",
        episode: 1,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/TV Shows/Sherlock/Sherlock.S02E03.A.Study.in.Pink.720p.BluRay.x264-CLUE.mkv",
    result: [
      {
        bestEffortShowName: "tv shows",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "sherlock",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "sherlock",
        episode: 3,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/TV/Better Call Saul/Better.Call.Saul.S06E13.Saul.Gone.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
    result: [
      {
        bestEffortShowName: "tv",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "better call saul",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "better call saul",
        episode: 13,
        season: 6,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/TV/The Mandalorian/S02/The.Mandalorian.S02E08.Chapter.16.The.Rescue.2160p.DSNP.WEB-DL.DDP5.1.Atmos.HDR.HEVC-MZABI.mkv",
    result: [
      {
        bestEffortShowName: "tv",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the mandalorian",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "s02",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the mandalorian",
        episode: 8,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/Videos/Stranger Things S01/Stranger.Things.S01E08.Chapter.Eight.The.Upside.Down.2160p.NF.WEBRip.x265-MIXED.mkv",
    result: [
      {
        bestEffortShowName: "videos",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "stranger things s01",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "stranger things",
        episode: 8,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/home/videos/The Office (US)/The.Office.US.S02E03.1080p.WEB-DL.DD5.1.H.264-NTb[rartv].mp4",
    result: [
      {
        bestEffortShowName: "home",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "videos",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the office",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "the office us",
        episode: 3,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "/media/series/Breaking Bad/Season 01/Breaking.Bad.S01E03.720p.BluRay.x264-DEMAND.mkv",
    result: [
      {
        bestEffortShowName: "media",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "series",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "breaking bad",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "season 01",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "breaking bad",
        episode: 3,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath: "Altered Carbon 720p 7x05 [www.torrentrapid.com].mkv",
    result: [
      {
        bestEffortShowName: "altered carbon",
        episode: 5,
        season: 7,
        type: "file",
      },
    ],
  },
  {
    filePath: "Altered Carbon 720p S07E05 [www.torrentrapid.com].mkv",
    result: [
      {
        bestEffortShowName: "altered carbon",
        episode: 5,
        season: 7,
        type: "file",
      },
    ],
  },
  {
    filePath:
      "Altered Carbon/Season 1/Altered Carbon 720p 1x05 [www.torrentrapid.com].mkv",
    result: [
      {
        bestEffortShowName: "altered carbon",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "season 1",
        episode: null,
        season: null,
        type: "directory",
      },
      {
        bestEffortShowName: "altered carbon",
        episode: 5,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath: "Breaking Bad S01E01.mkv",
    result: [
      {
        bestEffortShowName: "breaking bad",
        episode: 1,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath: "Game of Thrones 1x05 [1080p].mp4",
    result: [
      {
        bestEffortShowName: "game of thrones",
        episode: 5,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath: "Machine [HDTV 720p][Cap.101]/Machine [HDTV 720p][Cap.101].mkv",
    result: [
      {
        bestEffortShowName: "machine",
        episode: 1,
        season: 1,
        type: "directory",
      },
      {
        bestEffortShowName: "machine",
        episode: 1,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath: "Stargate SG-1 - S02E08 - Family DVD.avi",
    result: [
      {
        bestEffortShowName: "stargate sg-1",
        episode: 8,
        season: 2,
        type: "file",
      },
    ],
  },
  {
    filePath: "The Eternaut - S01E01 - A Night of Cards HDTV-720p.mkv",
    result: [
      {
        bestEffortShowName: "the eternaut",
        episode: 1,
        season: 1,
        type: "file",
      },
    ],
  },
  {
    filePath: "The Office (US) - S02E10 - Christmas Party.avi",
    result: [
      {
        bestEffortShowName: "the office",
        episode: 10,
        season: 2,
        type: "file",
      },
    ],
  },
];

describe("VideoFileParser", () => {
  const logger = new Logger({ logLevel: "error", name: "VideoFileParser" });
  const parser = new VideoFileParser({ logger });

  for (const { filePath, result } of testCases) {
    describe(`For the path: ${filePath}`, () => {
      it(`should return expected result`, () => {
        const parsed = parser.parse(filePath);
        expect(parsed).toStrictEqual(result);
      });
    });
  }
});
