import { watch, FSWatcher } from "chokidar";
import mitt, { type Emitter } from "mitt";
import { exists } from "fs/promises";
import path from "path";
import { Logger } from "../logging/Logger";

type FileWatcherEvents = {
  fileCreated: {
    filePath: string;
    fileName: string;
    timestamp: Date;
  };
  error: {
    message: string;
    error: Error;
  };
  ready: void;
  close: void;
};

export class FileWatcher {
  private emitter: Emitter<FileWatcherEvents>;
  private watcher: FSWatcher | null = null;
  private directoryPath: string;
  private logger: Logger;

  constructor({
    directoryPath,
    logger,
  }: {
    directoryPath: string;
    logger: Logger;
  }) {
    this.directoryPath = directoryPath;
    this.logger = logger;
    this.emitter = mitt<FileWatcherEvents>();
  }

  async start(): Promise<Emitter<FileWatcherEvents>> {
    if (!(await exists(this.directoryPath))) {
      setTimeout(() => {
        this.emitter.emit("error", {
          message: `Directory does not exist: ${this.directoryPath}`,
          error: new Error(`Directory not found: ${this.directoryPath}`),
        });
      }, 0);
      return this.emitter;
    }

    this.watcher = watch(this.directoryPath, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
    });

    this.watcher.on("add", (filePath: string) => {
      const fileName = path.basename(filePath);

      this.emitter.emit("fileCreated", {
        filePath,
        fileName,
        timestamp: new Date(),
      });
    });

    this.watcher.on("ready", () => {
      this.emitter.emit("ready");
    });

    this.watcher.on("error", (error) => {
      if (error instanceof Error) {
        this.emitter.emit("error", {
          message: "Error in file watcher",
          error,
        });
      }
    });

    this.emitter.on("close", () => {
      this.watcher?.close();
    });

    return this.emitter;
  }

  stop(): void {
    this.watcher?.close();
    this.emitter.emit("close");
  }
}
