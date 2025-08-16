import { watch } from "chokidar";
import mitt, { type Emitter } from "mitt";
import { exists } from "fs/promises";
import path from "path";

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

export async function createFileWatcher(
  directoryPath: string
): Promise<Emitter<FileWatcherEvents>> {
  const emitter = mitt<FileWatcherEvents>();

  if (!(await exists(directoryPath))) {
    setTimeout(() => {
      emitter.emit("error", {
        message: `El directorio no existe: ${directoryPath}`,
        error: new Error(`Directory not found: ${directoryPath}`),
      });
    }, 0);
    return emitter;
  }

  const watcher = watch(directoryPath, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
  });

  watcher.on("add", (filePath: string) => {
    const fileName = path.basename(filePath);

    emitter.emit("fileCreated", {
      filePath,
      fileName,
      timestamp: new Date(),
    });
  });

  watcher.on("ready", () => {
    emitter.emit("ready");
  });

  watcher.on("error", (error) => {
    if (Error.isError(error)) {
      emitter.emit("error", {
        message: "Error en el monitor de archivos",
        error,
      });
    }
  });

  emitter.on("close", () => {
    watcher.close();
  });

  return emitter as Emitter<FileWatcherEvents>;
}
