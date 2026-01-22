import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IgnoreFilter } from "./IgnoreFilter";
import { Logger } from "../logging/Logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("IgnoreFilter", () => {
  let ignoreFilter: IgnoreFilter;
  let testDir: string;
  let logger: Logger;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "chiprrignore-test-"));
    logger = new Logger({ logLevel: "error", name: "IgnoreFilter-Test" });
    ignoreFilter = new IgnoreFilter({ logger });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("empty .chiprrignore file", () => {
    it("should ignore all files in directory with empty .chiprrignore", async () => {
      // Create empty .chiprrignore
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "");

      // Create test file
      const testFile = path.join(testDir, "test.mkv");
      await fs.writeFile(testFile, "test content");

      const shouldIgnore = await ignoreFilter.shouldIgnore(testFile, testDir);
      expect(shouldIgnore).toBe(true);
    });

    it("should ignore all files in subdirectories when parent has empty .chiprrignore", async () => {
      // Create empty .chiprrignore in parent
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "");

      // Create subdirectory and file
      const subDir = path.join(testDir, "subdir");
      await fs.mkdir(subDir);
      const testFile = path.join(subDir, "test.mkv");
      await fs.writeFile(testFile, "test content");

      const shouldIgnore = await ignoreFilter.shouldIgnore(testFile, testDir);
      expect(shouldIgnore).toBe(true);
    });

    it("should ignore files in deeply nested directories", async () => {
      // Create empty .chiprrignore in parent
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "");

      // Create deeply nested structure
      const deepDir = path.join(testDir, "level1", "level2", "level3");
      await fs.mkdir(deepDir, { recursive: true });
      const testFile = path.join(deepDir, "test.mkv");
      await fs.writeFile(testFile, "test content");

      const shouldIgnore = await ignoreFilter.shouldIgnore(testFile, testDir);
      expect(shouldIgnore).toBe(true);
    });
  });

  describe("pattern matching", () => {
    it("should ignore files matching glob patterns", async () => {
      // Create .chiprrignore with pattern
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log\n*.tmp");

      // Create matching files
      const logFile = path.join(testDir, "test.log");
      const tmpFile = path.join(testDir, "temp.tmp");
      const mkvFile = path.join(testDir, "video.mkv");

      await fs.writeFile(logFile, "");
      await fs.writeFile(tmpFile, "");
      await fs.writeFile(mkvFile, "");

      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(tmpFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(mkvFile, testDir)).toBe(false);
    });

    it("should handle negation patterns", async () => {
      // Create .chiprrignore with negation
      await fs.writeFile(
        path.join(testDir, ".chiprrignore"),
        "*.txt\n!important.txt",
      );

      const normalTxt = path.join(testDir, "normal.txt");
      const importantTxt = path.join(testDir, "important.txt");

      await fs.writeFile(normalTxt, "");
      await fs.writeFile(importantTxt, "");

      expect(await ignoreFilter.shouldIgnore(normalTxt, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(importantTxt, testDir)).toBe(
        false,
      );
    });

    it("should handle directory patterns", async () => {
      // Create .chiprrignore with directory pattern
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "logs/");

      // Create logs directory and file
      const logsDir = path.join(testDir, "logs");
      await fs.mkdir(logsDir);
      const logFile = path.join(logsDir, "app.log");
      await fs.writeFile(logFile, "");

      // Create non-logs file
      const videoFile = path.join(testDir, "video.mkv");
      await fs.writeFile(videoFile, "");

      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(videoFile, testDir)).toBe(false);
    });

    it("should handle wildcard patterns", async () => {
      // Create .chiprrignore with wildcard
      await fs.writeFile(
        path.join(testDir, ".chiprrignore"),
        "*sample*\n*SAMPLE*",
      );

      const sampleFile = path.join(testDir, "video-sample.mkv");
      const sampleUpperFile = path.join(testDir, "SAMPLE-video.mkv");
      const normalFile = path.join(testDir, "video.mkv");

      await fs.writeFile(sampleFile, "");
      await fs.writeFile(sampleUpperFile, "");
      await fs.writeFile(normalFile, "");

      expect(await ignoreFilter.shouldIgnore(sampleFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(sampleUpperFile, testDir)).toBe(
        true,
      );
      expect(await ignoreFilter.shouldIgnore(normalFile, testDir)).toBe(false);
    });

    it("should handle comments in .chiprrignore", async () => {
      // Create .chiprrignore with comments
      await fs.writeFile(
        path.join(testDir, ".chiprrignore"),
        "# This is a comment\n*.log\n# Another comment\n*.tmp",
      );

      const logFile = path.join(testDir, "test.log");
      await fs.writeFile(logFile, "");

      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
    });
  });

  describe("hierarchical rules", () => {
    it("should apply parent directory rules to children", async () => {
      // Create .chiprrignore in parent
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log");

      // Create subdirectory and log file
      const subDir = path.join(testDir, "subdir");
      await fs.mkdir(subDir);
      const logFile = path.join(subDir, "test.log");
      await fs.writeFile(logFile, "");

      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
    });

    it("should combine rules from multiple levels", async () => {
      // Create .chiprrignore in parent
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log");

      // Create subdirectory with its own .chiprrignore
      const subDir = path.join(testDir, "subdir");
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, ".chiprrignore"), "*.tmp");

      // Create files
      const logFile = path.join(subDir, "test.log");
      const tmpFile = path.join(subDir, "test.tmp");
      const mkvFile = path.join(subDir, "test.mkv");

      await fs.writeFile(logFile, "");
      await fs.writeFile(tmpFile, "");
      await fs.writeFile(mkvFile, "");

      // Both parent and child rules should apply
      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(tmpFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(mkvFile, testDir)).toBe(false);
    });

    it("should handle child directory overriding parent with negation", async () => {
      // Create .chiprrignore in parent
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.txt");

      // Create subdirectory with negation
      const subDir = path.join(testDir, "important");
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, ".chiprrignore"), "!*.txt");

      const txtFile = path.join(subDir, "important.txt");
      await fs.writeFile(txtFile, "");

      // Note: gitignore semantics - parent rules still apply
      // This test documents the behavior
      expect(await ignoreFilter.shouldIgnore(txtFile, testDir)).toBe(true);
    });
  });

  describe("no .chiprrignore file", () => {
    it("should not ignore files when no .chiprrignore exists", async () => {
      const testFile = path.join(testDir, "test.mkv");
      await fs.writeFile(testFile, "");

      expect(await ignoreFilter.shouldIgnore(testFile, testDir)).toBe(false);
    });

    it("should not ignore files in subdirectories when no .chiprrignore exists", async () => {
      const subDir = path.join(testDir, "subdir");
      await fs.mkdir(subDir);
      const testFile = path.join(subDir, "test.mkv");
      await fs.writeFile(testFile, "");

      expect(await ignoreFilter.shouldIgnore(testFile, testDir)).toBe(false);
    });
  });

  describe("real-time updates", () => {
    it("should reflect changes to .chiprrignore immediately", async () => {
      // Create .chiprrignore that ignores .log files
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log");

      const logFile = path.join(testDir, "test.log");
      await fs.writeFile(logFile, "");

      // First call - should ignore
      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);

      // Update .chiprrignore to not ignore .log files
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.tmp");

      // Second call - should NOT ignore (change is reflected immediately)
      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should check root .chiprrignore for files at root level", async () => {
      // Create .chiprrignore at root
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log");

      const logFile = path.join(testDir, "test.log");
      const mkvFile = path.join(testDir, "video.mkv");
      await fs.writeFile(logFile, "");
      await fs.writeFile(mkvFile, "");

      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(mkvFile, testDir)).toBe(false);
    });

    it("should handle .chiprrignore with only whitespace as empty", async () => {
      // Create .chiprrignore with only whitespace
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "   \n\n  \t  ");

      const testFile = path.join(testDir, "test.mkv");
      await fs.writeFile(testFile, "");

      expect(await ignoreFilter.shouldIgnore(testFile, testDir)).toBe(true);
    });

    it("should handle files at the base path level", async () => {
      // Create .chiprrignore
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log");

      const testFile = path.join(testDir, "test.log");
      await fs.writeFile(testFile, "");

      expect(await ignoreFilter.shouldIgnore(testFile, testDir)).toBe(true);
    });

    it("should handle complex nested directory structures", async () => {
      // Create .chiprrignore at root
      await fs.writeFile(path.join(testDir, ".chiprrignore"), "*.log");

      // Create complex structure
      const deepPath = path.join(testDir, "shows", "Breaking Bad", "Season 1");
      await fs.mkdir(deepPath, { recursive: true });

      const logFile = path.join(deepPath, "debug.log");
      const videoFile = path.join(deepPath, "episode.mkv");

      await fs.writeFile(logFile, "");
      await fs.writeFile(videoFile, "");

      expect(await ignoreFilter.shouldIgnore(logFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(videoFile, testDir)).toBe(false);
    });
  });

  describe("real-world patterns", () => {
    it("should ignore common unwanted files", async () => {
      // Create realistic .chiprrignore
      await fs.writeFile(
        path.join(testDir, ".chiprrignore"),
        `# Ignore sample files
*sample*
*SAMPLE*

# Ignore subtitle files
*.srt
*.sub
*.ass

# Ignore NFO files
*.nfo

# Ignore extras
extras/
Extras/
behind.the.scenes/`,
      );

      // Create test structure
      const extrasDir = path.join(testDir, "extras");
      await fs.mkdir(extrasDir);

      const sampleFile = path.join(testDir, "video-sample.mkv");
      const srtFile = path.join(testDir, "video.srt");
      const nfoFile = path.join(testDir, "info.nfo");
      const extrasFile = path.join(extrasDir, "interview.mkv");
      const videoFile = path.join(testDir, "episode.mkv");

      await fs.writeFile(sampleFile, "");
      await fs.writeFile(srtFile, "");
      await fs.writeFile(nfoFile, "");
      await fs.writeFile(extrasFile, "");
      await fs.writeFile(videoFile, "");

      expect(await ignoreFilter.shouldIgnore(sampleFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(srtFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(nfoFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(extrasFile, testDir)).toBe(true);
      expect(await ignoreFilter.shouldIgnore(videoFile, testDir)).toBe(false);
    });
  });
});
