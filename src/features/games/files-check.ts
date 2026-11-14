export const MAX_GAME_BYTES = 400_000_000;
export const MAX_GAME_FILES = 1_500;
export const MAX_FILE_BYTES = 50_000_000;

export interface PulledFile {
  path: string;
  size: number;
  kind: "file" | "link" | "lfs";
}

export function connectHostsFrom(text: string): { hosts: string[] } | { problem: string } {
  throw new Error(`not built yet: ${text}`);
}

export function checkGameFiles(
  files: readonly PulledFile[],
  indexHtml: string | null,
): { ok: true; fileCount: number; totalBytes: number } | { ok: false; problem: string } {
  throw new Error(`not built yet: ${String(files.length)} ${String(indexHtml)}`);
}
