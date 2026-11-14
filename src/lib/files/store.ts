import type { ByteRange } from "./byte-range.ts";

// Where a game's files and clips are kept. Everything that stores or serves a file goes through this one small
// interface, so the games service and the gate can be tested with a store in memory and run on Cloudflare's R2
// without either knowing which one it has. It imports only the byte-range type, so the game gate (a separate
// Worker) can bundle it.

/** What is known about a stored file without reading it. */
export interface StoredFile {
  size: number;
  /** A quoted tag that changes whenever the file's bytes do; the gate uses it for conditional requests. */
  etag: string;
}

export interface FileStore {
  /** The file's size and tag, or null when no file has that key. Reads no bytes. */
  head(key: string): Promise<StoredFile | null>;
  /**
   * The file and a stream of its bytes (only the asked-for range when one is given), or null when no file has that
   * key. `file.size` is always the whole file's size, as for a ranged read of any file.
   */
  get(key: string, range?: ByteRange): Promise<{ file: StoredFile; body: ReadableStream<Uint8Array> } | null>;
  /** Stores the bytes under the key, replacing any file already there. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Removes the file. A key with no file is not an error. */
  delete(key: string): Promise<void>;
}
