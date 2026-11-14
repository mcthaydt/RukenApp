export interface TarEntry {
  path: string;
  kind: "file" | "directory" | "link" | "other";
  size: number;
  bytes(limit: number): Promise<Uint8Array>;
}

export function tarEntries(gzipped: ReadableStream<Uint8Array<ArrayBuffer>>): AsyncGenerator<TarEntry> {
  throw new Error(`not built yet: ${String(gzipped.locked)}`);
}
