import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { Logger } from "../logging/Logger";

export interface CachedShow {
  names: string[];
  id: number;
  name: string;
}

export interface CachedMovie {
  names: string[];
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
}

export type CachedMedia = CachedShow | CachedMovie;
export type MediaKind = "show" | "movie";

interface CacheEntry {
  searchTerm: string;
  result: CachedMedia[];
}

export class TMDBCache {
  private cache: Map<string, CachedMedia[]> = new Map();
  private cacheFilePath?: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly SAVE_DELAY_MS = 1000; // Debounce writes by 1 second
  private logger: Logger;
  private inMemory: boolean;

  constructor({
    cacheFilePath,
    logger,
  }: {
    cacheFilePath?: string;
    logger: Logger;
  }) {
    this.logger = logger;
    this.inMemory = typeof cacheFilePath !== "string";

    if (!this.inMemory) {
      this.cacheFilePath = cacheFilePath!;
      this.loadCache();
    }
  }

  private loadCache(): void {
    try {
      if (!fsSync.existsSync(this.cacheFilePath!)) {
        return;
      }

      this.logger.info(`Loading TMDB cache from ${this.cacheFilePath!}`);

      const fd = fsSync.openSync(this.cacheFilePath!, "r");
      const bufferSize = 64 * 1024; // 64KB buffer
      const buffer = Buffer.alloc(bufferSize);
      let leftover = "";
      let bytesRead: number;

      while (
        (bytesRead = fsSync.readSync(fd, buffer, 0, bufferSize, null)) > 0
      ) {
        const chunk = leftover + buffer.toString("utf-8", 0, bytesRead);
        const lines = chunk.split("\n");
        leftover = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            try {
              const entry: CacheEntry = JSON.parse(trimmedLine);
              this.cache.set(entry.searchTerm, entry.result);
            } catch {
              this.logger.warn(
                `Failed to parse cache line: ${trimmedLine.substring(0, 50)}...`,
              );
            }
          }
        }
      }

      // Process any remaining content in leftover
      const trimmedLeftover = leftover.trim();
      if (trimmedLeftover) {
        try {
          const entry: CacheEntry = JSON.parse(trimmedLeftover);
          this.cache.set(entry.searchTerm, entry.result);
        } catch {
          this.logger.warn(
            `Failed to parse final cache line: ${trimmedLeftover.substring(0, 50)}...`,
          );
        }
      }

      fsSync.closeSync(fd);
    } catch (error) {
      // If cache file is corrupted or doesn't exist, start with empty cache
      this.logger.warn(`Failed to load TMDB cache, starting fresh: ${error}`);
      this.cache = new Map();
    }
  }

  private scheduleSave(): void {
    if (this.inMemory) return;

    // Clear any existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Schedule a new save
    this.saveTimeout = setTimeout(() => {
      this.saveCache();
    }, this.SAVE_DELAY_MS);
  }

  private async saveCache(): Promise<void> {
    if (this.inMemory) return;

    try {
      // Ensure the cache directory exists
      const cacheDir = path.dirname(this.cacheFilePath!);
      if (cacheDir !== ".") {
        await fs.mkdir(cacheDir, { recursive: true });
      }

      // Build JSONL content - one JSON object per line
      const lines: string[] = [];
      this.cache.forEach((result, searchTerm) => {
        const entry: CacheEntry = { searchTerm, result };
        lines.push(JSON.stringify(entry));
      });

      await fs.writeFile(this.cacheFilePath!, lines.join("\n"), "utf-8");
      this.logger.debug(`Saved TMDB cache to ${this.cacheFilePath!}`);
    } catch (error) {
      this.logger.error(`Failed to save TMDB cache: ${error}`);
    }
  }

  get<T extends CachedMedia>(query: string): T[] | undefined {
    return this.cache.get(query) as T[] | undefined;
  }

  set<T extends CachedMedia>(query: string, media: T[]): void {
    this.cache.set(query, media);
    this.scheduleSave();
  }

  has(query: string): boolean {
    return this.cache.has(query);
  }

  getSearch<T extends CachedMedia>(
    kind: MediaKind,
    query: string,
    year?: number,
  ): T[] | undefined {
    const result = this.get<T>(this.searchKey(kind, query, year));
    if (result !== undefined) {
      return result;
    }

    // Cache files created before movie support used the raw show query as key.
    // Read them for backward compatibility, but all new entries are namespaced.
    if (kind === "show") {
      return this.get<T>(query.toLowerCase());
    }

    return undefined;
  }

  setSearch<T extends CachedMedia>(
    kind: MediaKind,
    query: string,
    result: T[],
    year?: number,
  ): void {
    this.set(this.searchKey(kind, query, year), result);
  }

  private searchKey(kind: MediaKind, query: string, year?: number): string {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return `${kind}:${normalizedQuery}:${year ?? ""}`;
  }

  clear(): void {
    this.cache.clear();
    this.scheduleSave();
  }
}
