// A size a person reads at a glance. The same words show on a game's page, in the file picker and in a refusal, so
// "1 KB" and "4.2 MB" read the same everywhere. Sizes are measured from files, never typed.

/** Under a megabyte in kilobytes (rounded up, never "0 KB"), otherwise in megabytes with one decimal. */
export function sizeWords(bytes: number): string {
  if (bytes < 1_000_000) return `${String(Math.max(1, Math.ceil(bytes / 1_000)))} KB`;
  return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
}
