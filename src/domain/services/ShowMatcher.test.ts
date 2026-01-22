import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { ShowMatcher } from "./ShowMatcher";
import { VideoFileParser } from "./VideoFileParser";
import { Logger } from "../../infrastructure/logging/Logger";
import { TMDBClient } from "../../infrastructure/tmdb/TMDBClient";
import { TMDBCache } from "../../infrastructure/tmdb/TMDBCache";

const testCases: Array<{
  filePath: string;
  expectedShow: string;
  expectedSeason: number;
  expectedEpisode: number;
}> = [
  {
    filePath: "Machine [HDTV 720p][Cap.101]/Machine [HDTV 720p][Cap.101].mkv",
    expectedShow: "Machine",
    expectedSeason: 1,
    expectedEpisode: 1,
  },
  {
    filePath: "Breaking Bad S01E01.mkv",
    expectedShow: "Breaking Bad",
    expectedSeason: 1,
    expectedEpisode: 1,
  },
  {
    filePath: "Game of Thrones 1x05 [1080p].mp4",
    expectedShow: "Game of Thrones",
    expectedSeason: 1,
    expectedEpisode: 5,
  },
  {
    filePath: "The Office (US) - S02E10 - Christmas Party.avi",
    expectedShow: "The Office",
    expectedSeason: 2,
    expectedEpisode: 10,
  },
  {
    filePath: "The Eternaut - S01E01 - A Night of Cards HDTV-720p.mkv",
    expectedShow: "The Eternaut",
    expectedSeason: 1,
    expectedEpisode: 1,
  },
  {
    filePath: "Altered Carbon 720p 7x05 [www.torrentrapid.com].mkv",
    expectedShow: "Altered Carbon",
    expectedSeason: 7,
    expectedEpisode: 5,
  },
  {
    filePath: "Altered Carbon 720p S07E05 [www.torrentrapid.com].mkv",
    expectedShow: "Altered Carbon",
    expectedSeason: 7,
    expectedEpisode: 5,
  },
  {
    filePath: "Stargate SG-1 - S02E08 - Family DVD.avi",
    expectedShow: "Stargate SG-1",
    expectedSeason: 2,
    expectedEpisode: 8,
  },
  {
    filePath:
      "Altered Carbon/Season 1/Altered Carbon 720p 1x05 [www.torrentrapid.com].mkv",
    expectedShow: "Altered Carbon",
    expectedSeason: 1,
    expectedEpisode: 5,
  },
  {
    filePath:
      "/media/series/Breaking Bad/Season 01/Breaking.Bad.S01E03.720p.BluRay.x264-DEMAND.mkv",
    expectedShow: "Breaking Bad",
    expectedSeason: 1,
    expectedEpisode: 3,
  },
  {
    filePath:
      "/home/videos/The Office (US)/The.Office.US.S02E03.1080p.WEB-DL.DD5.1.H.264-NTb[rartv].mp4",
    expectedShow: "The Office",
    expectedSeason: 2,
    expectedEpisode: 3,
  },
  {
    filePath:
      "/TV Shows/Breaking Bad/Season 1/Breaking.Bad.S01E05.720p.HDTV.x264-CTU.mkv",
    expectedShow: "Breaking Bad",
    expectedSeason: 1,
    expectedEpisode: 5,
  },
  {
    filePath:
      "/Series/The Office (US)/The.Office.US.S02E15.1080p.WEB-DL.DD5.1.H264-KiNGS.mp4",
    expectedShow: "The Office",
    expectedSeason: 2,
    expectedEpisode: 15,
  },
  {
    filePath:
      "/Downloads/Game.of.Thrones.S08E06.The.Iron.Throne.REPACK.1080p.AMZN.WEB-DL.DDP5.1.H.264-GoT.mkv",
    expectedShow: "Game of Thrones",
    expectedSeason: 8,
    expectedEpisode: 6,
  },
  {
    filePath:
      "/Media/Friends/Friends - 2x04 - The One Where Monica Gets a Roommate.avi",
    expectedShow: "Friends",
    expectedSeason: 2,
    expectedEpisode: 4,
  },
  {
    filePath:
      "/Videos/Stranger Things S01/Stranger.Things.S01E08.Chapter.Eight.The.Upside.Down.2160p.NF.WEBRip.x265-MIXED.mkv",
    expectedShow: "Stranger Things",
    expectedSeason: 1,
    expectedEpisode: 8,
  },
  {
    filePath:
      "/TV/The Mandalorian/S02/The.Mandalorian.S02E08.Chapter.16.The.Rescue.2160p.DSNP.WEB-DL.DDP5.1.Atmos.HDR.HEVC-MZABI.mkv",
    expectedShow: "The Mandalorian",
    expectedSeason: 2,
    expectedEpisode: 8,
  },
  {
    filePath:
      "/Series/Casa de Papel/La.Casa.de.Papel.S02E03.720p.NF.WEB-DL.DDP5.1.x264-NTG.mkv",
    expectedShow: "Money Heist", // TMDB name for "La Casa de Papel"
    expectedSeason: 2,
    expectedEpisode: 3,
  },
  {
    filePath:
      "/Downloads/[SubsPlease] Attack on Titan - S04E28 (1080p) [A1B2C3D4].mkv",
    expectedShow: "Attack on Titan",
    expectedSeason: 4,
    expectedEpisode: 28,
  },
  {
    filePath:
      "/Media/The Witcher (2019)/The.Witcher.2019.S06E02.The.Ends.Beginning.1080p.NF.WEB-DL.DDP5.1.x264-NTG.mkv",
    expectedShow: "The Witcher",
    expectedSeason: 6,
    expectedEpisode: 2,
  },
  {
    filePath:
      "/TV Shows/Sherlock/Sherlock.S02E03.A.Study.in.Pink.720p.BluRay.x264-CLUE.mkv",
    expectedShow: "Sherlock",
    expectedSeason: 2,
    expectedEpisode: 3,
  },
  {
    filePath:
      "/Series/Narcos/Narcos.S03E10.Going.Back.to.Cali.1080p.NF.WEB-DL.DD+5.1.x264-TrollHD.mkv",
    expectedShow: "Narcos",
    expectedSeason: 3,
    expectedEpisode: 10,
  },
  {
    filePath:
      "/Downloads/Rick.and.Morty.S04E06.Never.Ricking.Morty.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
    expectedShow: "Rick and Morty",
    expectedSeason: 4,
    expectedEpisode: 6,
  },
  {
    filePath:
      "/Media/Peaky Blinders/Peaky.Blinders.S06E07.Lock.and.Key.1080p.iP.WEB-DL.AAC2.0.H.264-NTb.mkv",
    expectedShow: "Peaky Blinders",
    expectedSeason: 6,
    expectedEpisode: 7,
  },
  {
    filePath:
      "/TV/Better Call Saul/Better.Call.Saul.S06E13.Saul.Gone.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
    expectedShow: "Better Call Saul",
    expectedSeason: 6,
    expectedEpisode: 13,
  },
  {
    filePath:
      "/Series/Westworld/Westworld.S01E10.The.Bicameral.Mind.1080p.AMZN.WEB-DL.DD+5.1.H.264-CasStudio.mkv",
    expectedShow: "Westworld",
    expectedSeason: 1,
    expectedEpisode: 10,
  },
  {
    filePath:
      "/Downloads/The.Boys.S03E08.The.Instant.White-Hot.Wild.1080p.AMZN.WEB-DL.DDP5.1.H.264-CMRG.mkv",
    expectedShow: "The Boys",
    expectedSeason: 3,
    expectedEpisode: 8,
  },
  {
    filePath:
      "/Media/Ozark/Ozark.S04E14.A.Hard.Way.to.Go.1080p.NF.WEB-DL.DDP5.1.Atmos.HDR.HEVC-TEPES.mkv",
    expectedShow: "Ozark",
    expectedSeason: 4,
    expectedEpisode: 14,
  },
  {
    filePath:
      "/TV Shows/House of Cards/House.of.Cards.US.S01E01.720p.NF.WEBRip.DD5.1.x264-NTb.mkv",
    expectedShow: "House of Cards",
    expectedSeason: 1,
    expectedEpisode: 1,
  },
  {
    filePath:
      "/Series/Chernobyl (2019)/Chernobyl.S01E05.Vichnaya.Pamyat.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG.mkv",
    expectedShow: "Chernobyl",
    expectedSeason: 1,
    expectedEpisode: 5,
  },
  {
    filePath:
      "/Downloads/Euphoria.S02E08.All.My.Life.My.Heart.Has.Yearned.for.a.Thing.I.Cannot.Name.1080p.AMZN.WEB-DL.DDP5.1.H.264-TEPES.mkv",
    expectedShow: "Euphoria",
    expectedSeason: 2,
    expectedEpisode: 8,
  },
  {
    filePath: "/Downloads/One Punch Man S03 - E01 [Sub] 1080p.mkv",
    expectedShow: "One-Punch Man", // TMDB name
    expectedSeason: 3,
    expectedEpisode: 1,
  },
  {
    filePath:
      "/Downloads/Peaky Blinders (Proper) - Temporada 1 [HDTV 720p][Cap.105][AC3 5.1 Español Castellano]/PB 1x05 720p [www.newpct1.com].mkv",
    expectedShow: "Peaky Blinders", // Should match from directory, not filename "PB"
    expectedSeason: 1,
    expectedEpisode: 5,
  },
  {
    filePath:
      "/completed/Shows/Dark Matter - Temporada 1 [HDTV 720][Cap.110][AC3 5.1 Español Castellano]/DM110720p [www.newpct1.com].mkv",
    expectedShow: "Dark Matter", // Should match from directory, not filename "DM"
    expectedSeason: 1,
    expectedEpisode: 10,
  },
];

describe("ShowMatcher", () => {
  const logger = new Logger({ logLevel: "error", name: "ShowMatcher" });

  // Use dedicated test cache file in repository root
  const cache = new TMDBCache({
    cacheFilePath: "tmdb-test-cache.json",
    logger: new Logger({ logLevel: "error", name: "TMDBCache" }),
  });

  // Get API token from environment or use empty string (will use cache)
  const apiToken = process.env.TMDB_TOKEN || "";

  const tmdbClient = new TMDBClient({
    apiToken,
    cache,
    logger: new Logger({ logLevel: "error", name: "TMDBClient" }),
  });

  const showMatcher = new ShowMatcher({
    tmdbClient,
    logger,
  });

  const videoFileParser = new VideoFileParser({
    logger: new Logger({ logLevel: "error", name: "VideoFileParser" }),
  });

  beforeAll(() => {
    if (!apiToken) {
      logger.info(
        "No TMDB_TOKEN provided. Tests will only work if cache is populated.",
      );
    }
  });

  afterAll(async () => {
    await (cache as any).saveCache();
  });

  for (const {
    filePath,
    expectedShow,
    expectedSeason,
    expectedEpisode,
  } of testCases) {
    describe(`For the path: ${filePath}`, () => {
      it(`should match show: ${expectedShow}`, async () => {
        // Parse the file path
        const parsedPathElements = videoFileParser.parse(filePath);

        // Match with TMDB using path elements
        const matched = await showMatcher.match(parsedPathElements);

        expect(matched.showName).toBe(expectedShow);
        expect(matched.season).toBe(expectedSeason);
        expect(matched.episode).toBe(expectedEpisode);
      }, 30000); // 30 second timeout for API calls
    });
  }
});
