export interface MovieDirectoryConfig {
  movieInputDirectory?: string;
  movieSortedDirectory?: string;
}

export function validateMovieDirectoryConfig<T extends MovieDirectoryConfig>(
  config: T,
): T {
  const hasInputDirectory = Boolean(config.movieInputDirectory);
  const hasSortedDirectory = Boolean(config.movieSortedDirectory);

  if (hasInputDirectory !== hasSortedDirectory) {
    throw new Error(
      "Configuration validation failed: MOVIE_INPUT_DIRECTORY and MOVIE_SORTED_DIRECTORY must be configured together",
    );
  }

  return config;
}
