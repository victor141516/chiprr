import * as config from "./libs/config";
import { createHardLink } from "./libs/createHardLink";
import { createFileWatcher } from "./libs/fileWatcher";
import { isVideoFile } from "./libs/filterVideoFiles";
import {
  parseVideoFileName,
  type EpisodeInfo,
} from "./libs/parseVideoFileName/parseVideoFileName";
import { searchShow } from "./libs/tmdb";

const watcher = await createFileWatcher("./test/input");
watcher.on("fileCreated", async ({ filePath }) => {
  if (!isVideoFile(filePath)) return;

  let info: EpisodeInfo | null = null;
  try {
    info = parseVideoFileName(filePath);
  } catch (error) {
    console.error(error);
    return;
  }

  const searchResult = await searchShow(info!.showName, config.TMDB_TOKEN);

  let foundMarch = false;
  for (const show of searchResult) {
    if (show.name === info!.showName) {
      info.showName = show.name;
      foundMarch = true;
    }
  }

  if (foundMarch) {
    console.debug("Exact match found for:", info!.showName);
  }

  if (!foundMarch) {
    if (searchResult.length === 0) {
      console.warn("Could not found any match for name:", info!.showName);
    } else {
      console.warn(
        "Could not find exact match for:",
        info!.showName,
        ". Using first search result:",
        searchResult[0]!.name
      );
      info.showName = searchResult[0]!.name;
    }
  }

  await createHardLink(filePath, "./test/sorted", info!);
});
