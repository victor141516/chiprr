import * as fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Logger } from "../logging/Logger";
import { FileWatcher } from "./FileWatcher";

describe("FileWatcher", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "chiprr-watcher-"),
    );
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("ignores pre-existing files and emits newly created files", async () => {
    const existingFile = path.join(temporaryDirectory, "existing.mkv");
    await fs.writeFile(existingFile, "existing");
    const fileWatcher = new FileWatcher({
      directoryPath: temporaryDirectory,
      logger: new Logger({ logLevel: "error", name: "FileWatcherTest" }),
    });
    const emitter = await fileWatcher.start();
    const observed: string[] = [];
    emitter.on("fileCreated", ({ filePath }) => observed.push(filePath));

    await new Promise<void>((resolve) => emitter.on("ready", resolve));
    expect(observed).toEqual([]);

    const newFile = path.join(temporaryDirectory, "new.mkv");
    const created = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out waiting for fileCreated")),
        3000,
      );
      emitter.on("fileCreated", ({ filePath }) => {
        clearTimeout(timeout);
        resolve(filePath);
      });
    });
    await fs.writeFile(newFile, "new");

    await expect(created).resolves.toBe(newFile);
    expect(observed).toEqual([newFile]);
    fileWatcher.stop();
  });
});
