import { describe, expect, it } from "vitest";
import { parseVideoFileName, type EpisodeInfo } from "./parseVideoFileName";

const testCases: Array<{
  filePath: string;
  result: EpisodeInfo;
}> = [
  {
    filePath: "Machine [HDTV 720p][Cap.101]/Machine [HDTV 720p][Cap.101].mkv",
    result: { showName: "Machine", season: 1, episode: 1 },
  },
  {
    filePath: "Breaking Bad S01E01.mkv",
    result: { showName: "Breaking Bad", season: 1, episode: 1 },
  },
  {
    filePath: "Game of Thrones 1x05 [1080p].mp4",
    result: { showName: "Game of Thrones", season: 1, episode: 5 },
  },
  {
    filePath: "The Office (US) - S02E10 - Christmas Party.avi",
    result: { showName: "The Office", season: 2, episode: 10 },
  },
  {
    filePath: "The Eternaut - S01E01 - A Night of Cards HDTV-720p.mkv",
    result: { showName: "The Eternaut", season: 1, episode: 1 },
  },
  {
    filePath: "Altered Carbon 720p 7x05 [www.torrentrapid.com].mkv",
    result: { showName: "Altered Carbon", season: 7, episode: 5 },
  },
  {
    filePath: "Altered Carbon 720p S07E05 [www.torrentrapid.com].mkv",
    result: { showName: "Altered Carbon", season: 7, episode: 5 },
  },
  {
    filePath: "Stargate SG-1 - S02E08 - Family DVD.avi",
    result: { showName: "Stargate SG-1", season: 2, episode: 8 },
  },
  {
    filePath:
      "Altered Carbon/Season 1/Altered Carbon 720p 1x05 [www.torrentrapid.com].mkv",
    result: {
      episode: 5,
      season: 1,
      showName: "Altered Carbon",
    },
  },
  {
    filePath:
      "/media/series/Breaking Bad/Season 01/Breaking.Bad.S01E03.720p.BluRay.x264-DEMAND.mkv",
    result: {
      episode: 3,
      season: 1,
      showName: "Breaking Bad",
    },
  },
  {
    filePath:
      "/home/videos/The Office (US)/The.Office.US.S02E03.1080p.WEB-DL.DD5.1.H.264-NTb[rartv].mp4",
    result: { showName: "The Office", season: 2, episode: 3 },
  },
  {
    filePath:
      "/TV Shows/Breaking Bad/Season 1/Breaking.Bad.S01E05.720p.HDTV.x264-CTU.mkv",
    result: {
      episode: 5,
      season: 1,
      showName: "Breaking Bad",
    },
  },
  {
    filePath:
      "/Series/The Office (US)/The.Office.US.S02E15.1080p.WEB-DL.DD5.1.H264-KiNGS.mp4",
    result: {
      episode: 15,
      season: 2,
      showName: "The Office",
    },
  },
  {
    filePath:
      "/Downloads/Game.of.Thrones.S08E06.The.Iron.Throne.REPACK.1080p.AMZN.WEB-DL.DDP5.1.H.264-GoT.mkv",
    result: {
      episode: 6,
      season: 8,
      showName: "Game of Thrones",
    },
  },
  {
    filePath:
      "/Media/Friends/Friends - 2x04 - The One Where Monica Gets a Roommate.avi",
    result: {
      episode: 4,
      season: 2,
      showName: "Friends",
    },
  },
  {
    filePath:
      "/Videos/Stranger Things S01/Stranger.Things.S01E08.Chapter.Eight.The.Upside.Down.2160p.NF.WEBRip.x265-MIXED.mkv",
    result: {
      episode: 8,
      season: 1,
      showName: "Stranger Things",
    },
  },
  {
    filePath:
      "/TV/The Mandalorian/S02/The.Mandalorian.S02E08.Chapter.16.The.Rescue.2160p.DSNP.WEB-DL.DDP5.1.Atmos.HDR.HEVC-MZABI.mkv",
    result: {
      episode: 8,
      season: 2,
      showName: "The Mandalorian",
    },
  },
  {
    filePath:
      "/Series/Casa de Papel/La.Casa.de.Papel.S02E03.720p.NF.WEB-DL.DDP5.1.x264-NTG.mkv",
    result: {
      episode: 3,
      season: 2,
      showName: "Casa de Papel",
    },
  },
  {
    filePath:
      "/Downloads/[SubsPlease] Attack on Titan - S04E28 (1080p) [A1B2C3D4].mkv",
    result: {
      episode: 28,
      season: 4,
      showName: "Attack on Titan",
    },
  },
  {
    filePath:
      "/Media/The Witcher (2019)/The.Witcher.2019.S06E02.The.Ends.Beginning.1080p.NF.WEB-DL.DDP5.1.x264-NTG.mkv",
    result: {
      episode: 2,
      season: 6,
      showName: "The Witcher",
    },
  },
  {
    filePath:
      "/TV Shows/Sherlock/Sherlock.S02E03.A.Study.in.Pink.720p.BluRay.x264-CLUE.mkv",
    result: {
      episode: 3,
      season: 2,
      showName: "Sherlock",
    },
  },
  {
    filePath:
      "/Series/Narcos/Narcos.S03E10.Going.Back.to.Cali.1080p.NF.WEB-DL.DD+5.1.x264-TrollHD.mkv",
    result: {
      episode: 10,
      season: 3,
      showName: "Narcos",
    },
  },
  {
    filePath:
      "/Downloads/Rick.and.Morty.S04E06.Never.Ricking.Morty.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
    result: {
      episode: 6,
      season: 4,
      showName: "Rick and Morty",
    },
  },
  {
    filePath:
      "/Media/Peaky Blinders/Peaky.Blinders.S06E07.Lock.and.Key.1080p.iP.WEB-DL.AAC2.0.H.264-NTb.mkv",
    result: {
      episode: 7,
      season: 6,
      showName: "Peaky Blinders",
    },
  },
  {
    filePath:
      "/TV/Better Call Saul/Better.Call.Saul.S06E13.Saul.Gone.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
    result: {
      episode: 13,
      season: 6,
      showName: "Better Call Saul",
    },
  },
  {
    filePath:
      "/Series/Westworld/Westworld.S01E10.The.Bicameral.Mind.1080p.AMZN.WEB-DL.DD+5.1.H.264-CasStudio.mkv",
    result: {
      episode: 10,
      season: 1,
      showName: "Westworld",
    },
  },
  {
    filePath:
      "/Downloads/The.Boys.S03E08.The.Instant.White-Hot.Wild.1080p.AMZN.WEB-DL.DDP5.1.H.264-CMRG.mkv",
    result: {
      episode: 8,
      season: 3,
      showName: "The Boys",
    },
  },
  {
    filePath:
      "/Media/Ozark/Ozark.S04E14.A.Hard.Way.to.Go.1080p.NF.WEB-DL.DDP5.1.Atmos.HDR.HEVC-TEPES.mkv",
    result: {
      episode: 14,
      season: 4,
      showName: "Ozark",
    },
  },
  {
    filePath:
      "/TV Shows/House of Cards/House.of.Cards.US.S01E01.720p.NF.WEBRip.DD5.1.x264-NTb.mkv",
    result: {
      episode: 1,
      season: 1,
      showName: "House of Cards",
    },
  },
  {
    filePath:
      "/Series/Chernobyl (2019)/Chernobyl.S01E05.Vichnaya.Pamyat.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG.mkv",
    result: {
      episode: 5,
      season: 1,
      showName: "Chernobyl",
    },
  },
  {
    filePath:
      "/Downloads/Euphoria.S02E08.All.My.Life.My.Heart.Has.Yearned.for.a.Thing.I.Cannot.Name.1080p.AMZN.WEB-DL.DDP5.1.H.264-TEPES.mkv",
    result: {
      episode: 8,
      season: 2,
      showName: "Euphoria",
    },
  },
];

describe("parseVideoFileName", () => {
  for (const { filePath, result } of testCases) {
    describe(`For the path: ${filePath}`, () => {
      it(`should return: ${JSON.stringify(result)}`, () => {
        expect(parseVideoFileName(filePath)).toEqual(result);
      });
    });
  }
});
