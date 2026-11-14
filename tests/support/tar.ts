const BLOCK = 512;

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Writes `text` into the header at `offset`, as plain bytes, leaving the rest of the field zeros. */
function putText(header: Uint8Array, offset: number, text: string): void {
  header.set(utf8(text), offset);
}

/**
 * One 512-byte ustar header. `name` is cut to what the field holds (100 bytes); a longer path is carried by a pax
 * header before it, as `git archive` and GitHub do.
 */
function headerFor(name: string, size: number, type: string, linkTarget = ""): Uint8Array {
  const header = new Uint8Array(BLOCK);
  putText(header, 0, name.slice(0, 100));
  putText(header, 100, "0000644\0");
  putText(header, 108, "0000000\0");
  putText(header, 116, "0000000\0");
  putText(header, 124, `${size.toString(8).padStart(11, "0")}\0`);
  putText(header, 136, "00000000000\0");
  putText(header, 156, type);
  putText(header, 157, linkTarget.slice(0, 100));
  putText(header, 257, "ustar\0");
  putText(header, 263, "00");
  // The checksum is the sum of every byte of the header with the checksum field itself counted as spaces.
  putText(header, 148, "        ");
  const sum = header.reduce((total, byte) => total + byte, 0);
  putText(header, 148, `${sum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

/** A pax record is `<length> <key>=<value>\n`, where the length counts the whole record, its own digits included. */
function paxRecord(key: string, value: string): Uint8Array {
  const body = ` ${key}=${value}\n`;
  const bodyBytes = utf8(body).length;
  let length = bodyBytes + 1;
  while (String(length).length + bodyBytes !== length) length = String(length).length + bodyBytes;
  return utf8(`${String(length)}${body}`);
}

function padded(content: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(content.length / BLOCK) * BLOCK);
  out.set(content);
  return out;
}

/** The entry a file makes: its header, then its content padded to whole blocks. A path over 100 bytes comes first. */
function entryBlocks(file: { path: string; content: Uint8Array | string; link?: true }): Uint8Array[] {
  const blocks: Uint8Array[] = [];
  if (utf8(file.path).length > 100) {
    const pax = paxRecord("path", file.path);
    blocks.push(headerFor("PaxHeader", pax.length, "x"), padded(pax));
  }
  if (file.link === true) {
    // A link's "content" is the name it points at, kept in the header, with no data after it.
    blocks.push(headerFor(file.path, 0, "2", String(file.content)));
  } else {
    const content = typeof file.content === "string" ? utf8(file.content) : file.content;
    blocks.push(headerFor(file.path, content.length, "0"), padded(content));
  }
  return blocks;
}

/**
 * A `.tar.gz` made in a test: ustar headers, a pax `x` header for a path over 100 characters, two empty blocks at
 * the end, gzipped with the platform's own `CompressionStream`. Test code only: nothing in `src/` writes a tar.
 */
export async function tarGz(
  files: readonly { path: string; content: Uint8Array | string; link?: true }[],
): Promise<Uint8Array<ArrayBuffer>> {
  const blocks = [...files.flatMap(entryBlocks), new Uint8Array(BLOCK * 2)];
  const tar = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0));
  let at = 0;
  for (const block of blocks) {
    tar.set(block, at);
    at += block.length;
  }
  const zipped = new Blob([tar]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(zipped).arrayBuffer());
}
