import * as fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Logger } from "../logging/Logger";
import { HardLinkCreator } from "./HardLinkCreator";

describe("HardLinkCreator", () => {
  let temporaryDirectory: string;
  let completedDirectory: string;
  let movieDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "chiprr-link-"),
    );
    completedDirectory = path.join(temporaryDirectory, "completed");
    movieDirectory = path.join(temporaryDirectory, "movies");
    await fs.mkdir(completedDirectory, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  function creator(replaceIfExists: boolean): HardLinkCreator {
    return new HardLinkCreator({
      sortedDirectory: movieDirectory,
      replaceIfExists,
      logger: new Logger({ logLevel: "error", name: "HardLinkCreatorTest" }),
    });
  }

  it("creates a flat movie hard link without removing the source", async () => {
    const source = path.join(completedDirectory, "Jurassic.Park.1993.mkv");
    await fs.writeFile(source, "movie-data");

    await creator(false).createLink(source, {
      kind: "movie",
      title: "Jurassic Park",
      year: 1993,
    });

    const destination = path.join(movieDirectory, "Jurassic Park (1993).mkv");
    const [sourceStat, destinationStat] = await Promise.all([
      fs.stat(source),
      fs.stat(destination),
    ]);
    expect(destinationStat.ino).toBe(sourceStat.ino);
    expect(sourceStat.nlink).toBeGreaterThanOrEqual(2);
    await expect(fs.readFile(source, "utf8")).resolves.toBe("movie-data");
  });

  it("leaves an existing destination untouched by default", async () => {
    const firstSource = path.join(completedDirectory, "first.mkv");
    const secondSource = path.join(completedDirectory, "second.mkv");
    await fs.writeFile(firstSource, "first");
    await fs.writeFile(secondSource, "second");
    const media = { kind: "movie", title: "Arrival", year: 2016 } as const;
    const linkCreator = creator(false);

    await linkCreator.createLink(firstSource, media);
    await expect(
      linkCreator.createLink(secondSource, media),
    ).rejects.toMatchObject({
      code: "EEXIST",
    });
    await expect(
      fs.readFile(path.join(movieDirectory, "Arrival (2016).mkv"), "utf8"),
    ).resolves.toBe("first");
  });

  it("replaces an existing destination only when configured", async () => {
    const firstSource = path.join(completedDirectory, "first.mkv");
    const secondSource = path.join(completedDirectory, "second.mkv");
    await fs.writeFile(firstSource, "first");
    await fs.writeFile(secondSource, "second");
    const media = { kind: "movie", title: "Arrival", year: 2016 } as const;

    await creator(false).createLink(firstSource, media);
    await creator(true).createLink(secondSource, media);

    const destination = path.join(movieDirectory, "Arrival (2016).mkv");
    const [sourceStat, destinationStat] = await Promise.all([
      fs.stat(secondSource),
      fs.stat(destination),
    ]);
    expect(destinationStat.ino).toBe(sourceStat.ino);
    await expect(fs.readFile(destination, "utf8")).resolves.toBe("second");
  });

  it("does not fail in replace mode when the destination does not exist", async () => {
    const source = path.join(completedDirectory, "new.mp4");
    await fs.writeFile(source, "new");

    await expect(
      creator(true).createLink(source, {
        kind: "movie",
        title: "New Movie",
        year: null,
      }),
    ).resolves.toBeUndefined();
  });
});
