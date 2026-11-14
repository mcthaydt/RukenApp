// Reads the files out of a `.tar.gz` as it streams past, so a game's files can be checked and stored without the
// whole download being held in memory. It imports nothing, so both Workers can bundle it.

/** One thing in the archive. `bytes` reads its content, once, if the caller wants it; otherwise it is skipped. */
export interface TarEntry {
  path: string;
  kind: "file" | "directory" | "link" | "other";
  size: number;
  /** The entry's content. Throws `RangeError`, before reading anything, when `size` is over `limit`. */
  bytes(limit: number): Promise<Uint8Array>;
}

const BLOCK = 512;
const ENDED_EARLY = "The download ended early.";
/** A pax or GNU long-name header holds one path and a few small facts; a megabyte is far more than any real one. */
const META_LIMIT = 1_000_000;

const utf8 = new TextDecoder();

/**
 * The decompressed stream, read in the pieces the caller asks for however the stream happens to be cut: a header can
 * start at the end of one piece and finish in the next.
 */
class ByteReader {
  readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
  #piece = new Uint8Array(0);
  #at = 0;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.#reader = stream.getReader();
  }

  /** Fills `target` from the stream and answers how many bytes it got: fewer than asked only at the stream's end. */
  async fill(target: Uint8Array): Promise<number> {
    let filled = 0;
    while (filled < target.length) {
      if (this.#at >= this.#piece.length && !(await this.#nextPiece())) break;
      const take = this.#piece.subarray(this.#at, this.#at + target.length - filled);
      target.set(take, filled);
      filled += take.length;
      this.#at += take.length;
    }
    return filled;
  }

  /** Reads and drops `count` bytes, holding none of them. */
  async skip(count: number): Promise<void> {
    let left = count;
    while (left > 0) {
      if (this.#at >= this.#piece.length && !(await this.#nextPiece())) throw new Error(ENDED_EARLY);
      const take = Math.min(left, this.#piece.length - this.#at);
      this.#at += take;
      left -= take;
    }
  }

  /** Lets the download go: a reader that stops early must not leave the connection open. */
  async close(): Promise<void> {
    await this.#reader.cancel().catch(() => undefined);
  }

  async #nextPiece(): Promise<boolean> {
    try {
      const next = await this.#reader.read();
      if (next.done) return false;
      this.#piece = next.value;
      this.#at = 0;
      return true;
    } catch (cause) {
      // The unzipper fails when the compressed data stops short, which is how a cut-off download shows up here.
      throw new Error(ENDED_EARLY, { cause });
    }
  }
}

/** A text field of a header: its bytes up to the first zero. */
function textField(header: Uint8Array, offset: number, length: number): string {
  const field = header.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return utf8.decode(end === -1 ? field : field.subarray(0, end));
}

/** The size field, written as octal digits. */
function sizeOf(header: Uint8Array): number {
  const size = Number.parseInt(textField(header, 124, 12).trim(), 8);
  if (Number.isNaN(size) || size < 0) throw new Error("The download is not a tar file.");
  return size;
}

/** The path a plain header holds: its name, with the ustar prefix folder in front when it has one. */
function pathOf(header: Uint8Array): string {
  const name = textField(header, 0, 100);
  const isUstar = textField(header, 257, 5) === "ustar";
  const prefix = isUstar ? textField(header, 345, 155) : "";
  return prefix === "" ? name : `${prefix}/${name}`;
}

/** The `path` a pax header carries. Its records are `<length> <key>=<value>\n`, the length counting the record. */
function paxPath(content: Uint8Array): string | null {
  let at = 0;
  while (at < content.length) {
    const space = content.indexOf(0x20, at);
    if (space === -1) return null;
    const length = Number.parseInt(utf8.decode(content.subarray(at, space)), 10);
    if (Number.isNaN(length) || length <= 0) return null;
    const record = utf8.decode(content.subarray(space + 1, at + length - 1));
    if (record.startsWith("path=")) return record.slice("path=".length);
    at += length;
  }
  return null;
}

function kindOf(type: string): TarEntry["kind"] {
  if (type === "0" || type === "\0") return "file";
  if (type === "5") return "directory";
  if (type === "1" || type === "2") return "link";
  return "other";
}

const paddingAfter = (size: number): number => (BLOCK - (size % BLOCK)) % BLOCK;

/**
 * The entries of a gzipped tar, one at a time. A pax header (`x`) or a GNU long name (`L`) gives the next entry its
 * full path; a pax global header (`g`) is skipped. An entry whose `bytes` was not asked for is skipped as the next
 * one is read, so it is never held in memory.
 */
export async function* tarEntries(
  gzipped: ReadableStream<Uint8Array<ArrayBuffer>>,
): AsyncGenerator<TarEntry> {
  const input = new ByteReader(gzipped.pipeThrough(new DecompressionStream("gzip")));
  try {
    let longPath: string | null = null;
    for (;;) {
      const header = new Uint8Array(BLOCK);
      const got = await input.fill(header);
      // Two empty blocks end an archive. Some writers stop without them: the stream's end ends it too.
      if (got === 0 || header.every((byte) => byte === 0)) return;
      if (got < BLOCK) throw new Error(ENDED_EARLY);

      const size = sizeOf(header);
      const type = String.fromCharCode(header[156] ?? 0);

      if (type === "x" || type === "L" || type === "g") {
        if (size > META_LIMIT) throw new Error("The download is not a tar file.");
        const content = new Uint8Array(size);
        if ((await input.fill(content)) < size) throw new Error(ENDED_EARLY);
        await input.skip(paddingAfter(size));
        if (type === "x") longPath = paxPath(content) ?? longPath;
        if (type === "L") longPath = textField(content, 0, content.length);
        continue;
      }

      let spent = false;
      const entry: TarEntry = {
        path: longPath ?? pathOf(header),
        kind: kindOf(type),
        size,
        async bytes(limit) {
          if (size > limit)
            throw new RangeError(`An entry is ${String(size)} bytes, over the limit of ${String(limit)}.`);
          spent = true;
          // One array of exactly `size` bytes, filled piece by piece. A list of pieces joined at the end would hold the
          // file twice at once, and a 50 MB file has to fit in a Worker's 128 MB.
          const content = new Uint8Array(size);
          if ((await input.fill(content)) < size) throw new Error(ENDED_EARLY);
          await input.skip(paddingAfter(size));
          return content;
        },
      };
      longPath = null;

      yield entry;
      if (!spent) await input.skip(size + paddingAfter(size));
    }
  } finally {
    await input.close();
  }
}
