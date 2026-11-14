// The type each kind of game file is served with. It comes from the file's extension and never from its
// contents, so a game cannot get a browser to run a file as something it is not. Pure data with no imports, so
// the game gate (a separate Worker) can bundle it.

const TEXT = "text/plain; charset=utf-8";
const BINARY = "application/octet-stream";

export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  // Document and code
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  map: "application/json",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  txt: TEXT,
  md: TEXT,
  toml: TEXT,
  atlas: TEXT,
  fnt: TEXT,
  // Images and 3D
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  ktx2: "image/ktx2",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  bin: BINARY,
  basis: BINARY,
  data: BINARY,
  pck: BINARY,
  unityweb: BINARY,
  // Audio and video
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  // Fonts
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

/** Precompressed suffixes and the Content-Encoding they are served with. */
const ENCODINGS: Readonly<Record<string, "br" | "gzip">> = { br: "br", gz: "gzip" };

export interface ServedType {
  readonly contentType: string;
  /** Set for a precompressed `.br` / `.gz` file: served with this Content-Encoding and the inner type. */
  readonly encoding?: "br" | "gzip";
}

/** What a file Ruken does not know is served as: bytes a browser will not run (the gate adds `nosniff`). */
const PLAIN_BYTES: ServedType = { contentType: BINARY };

/**
 * The type a file is served with. A `.br` or `.gz` suffix is a precompressed file only over a known inner
 * extension (`main.js.br`); over an unknown one it is plain bytes, as is a name with no dot (`LICENSE`), a
 * dot-file (`.htaccess`) and any extension not in the table. A pull does not refuse such files: it checks only
 * what the design lists.
 */
export function servedTypeFor(path: string): ServedType {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  const parts = name.split(".");
  // A name without a dot ("LICENSE") or a dot-file (".htaccess") has no usable extension.
  if (parts.length < 2 || parts[0] === "") return PLAIN_BYTES;
  const last = parts[parts.length - 1] ?? "";

  const encoding = ownValue(ENCODINGS, last);
  if (encoding !== undefined) {
    if (parts.length < 3) return PLAIN_BYTES;
    const inner = ownValue(CONTENT_TYPES, parts[parts.length - 2] ?? "");
    return inner === undefined ? PLAIN_BYTES : { contentType: inner, encoding };
  }
  const contentType = ownValue(CONTENT_TYPES, last);
  return contentType === undefined ? PLAIN_BYTES : { contentType };
}

/**
 * `table[key]` for a key the table itself defines. A plain lookup would also find what every object inherits, so
 * `main.js.constructor` would come back with the Object function as its type.
 */
function ownValue<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
