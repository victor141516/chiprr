import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";

export interface CachedShow {
  names: string[];
  id: number;
  name: string;
}

// TODO: use logger
export class TMDBCache {
  private cache: Map<string, CachedShow[]> = new Map();
  private cacheFilePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly SAVE_DELAY_MS = 1000; // Debounce writes by 1 second

  constructor(cacheFilePath?: string) {
    // Default cache file path in .cache directory
    this.cacheFilePath =
      cacheFilePath || path.join(process.cwd(), ".cache", "tmdb-cache.json");
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fsSync.existsSync(this.cacheFilePath)) {
        console.log("Loading TMDB cache from", this.cacheFilePath);
        const data = fsSync.readFileSync(this.cacheFilePath, "utf-8");
        const parsed = JSON.parse(data);
        this.cache = new Map(Object.entries(parsed));
      }
    } catch (error) {
      // If cache file is corrupted or doesn't exist, start with empty cache
      console.warn("Failed to load TMDB cache, starting fresh:", error);
      this.cache = new Map();
    }
  }

  private scheduleSave(): void {
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
    try {
      // Ensure the cache directory exists
      const cacheDir = path.dirname(this.cacheFilePath);
      await fs.mkdir(cacheDir, { recursive: true });

      // Convert Map to plain object for JSON serialization
      const cacheObject = Object.fromEntries(this.cache);
      await fs.writeFile(
        this.cacheFilePath,
        JSON.stringify(cacheObject, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("Failed to save TMDB cache:", error);
    }
  }

  get(query: string): CachedShow[] | undefined {
    return this.cache.get(query);
  }

  set(query: string, shows: CachedShow[]): void {
    this.cache.set(query, shows);
    this.scheduleSave();
  }

  has(query: string): boolean {
    return this.cache.has(query);
  }

  clear(): void {
    this.cache.clear();
    this.scheduleSave();
  }
}
