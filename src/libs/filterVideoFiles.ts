const VIDEO_EXTENSIONS = [
  "mp4",
  "avi",
  "mov",
  "wmv",
  "webm",
  "flv",
  "m4v",
  "mkv",
  "vob",
  "ts",
  "3gp",
  "asf",
  "divx",
] as const;

export function isVideoFile(fileName: string) {
  return VIDEO_EXTENSIONS.some((ext) =>
    fileName.toLowerCase().endsWith(`.${ext}`)
  );
}
