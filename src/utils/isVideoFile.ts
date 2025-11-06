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
];

export function isVideoFile(filePath: string): boolean {
  const extension = filePath.split(".").pop()?.toLowerCase();
  return extension ? VIDEO_EXTENSIONS.includes(extension) : false;
}
