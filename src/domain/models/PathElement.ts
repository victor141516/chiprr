export interface PathElement {
  /** Type of path element: 'file' for video files, 'directory' for folders */
  type: "file" | "directory";

  /** Original name as it appears in the filesystem */
  originalName: string;

  /** Cleaned name with garbage removed (quality indicators, brackets, etc.) */
  cleanedName: string;

  /** Parsed episode information if extraction was successful */
  episodeInfo?: {
    season?: number;
    episode?: number;
    matchedStrings: string[];
  };

  /** Index in the path (0 = furthest from file, increases toward file) */
  index: number;
}
