import { describe, expect, it } from "vitest";
import { CONTENT_TYPES, servedTypeFor } from "../../../src/lib/files/content-types.ts";

const PLAIN_BYTES = { contentType: "application/octet-stream" };

describe("servedTypeFor", () => {
  it.each([
    ["index.html", "text/html; charset=utf-8"],
    ["a/main.mjs", "text/javascript; charset=utf-8"],
    ["style.css", "text/css; charset=utf-8"],
    ["data.json", "application/json"],
    ["app.webmanifest", "application/manifest+json"],
    ["game.wasm", "application/wasm"],
    ["notes.toml", "text/plain; charset=utf-8"],
    ["logo.svg", "image/svg+xml"],
    ["tex.ktx2", "image/ktx2"],
    ["scene.glb", "model/gltf-binary"],
    ["scene.gltf", "model/gltf+json"],
    ["game.pck", "application/octet-stream"],
    ["music.ogg", "audio/ogg"],
    ["intro.mp4", "video/mp4"],
    ["font.woff2", "font/woff2"],
    ["IMAGE.PNG", "image/png"],
  ])("serves %s as %s", (path, contentType) => {
    expect(servedTypeFor(path)).toEqual({ contentType });
  });

  it("serves a precompressed file with the inner type and its encoding", () => {
    expect(servedTypeFor("main.js.br")).toEqual({
      contentType: "text/javascript; charset=utf-8",
      encoding: "br",
    });
    expect(servedTypeFor("game.wasm.gz")).toEqual({ contentType: "application/wasm", encoding: "gzip" });
  });

  // Review Focus 11: a file Ruken does not know is plain bytes, which a browser will not run, and the type
  // never comes from the file's contents.
  it.each(["LICENSE", ".htaccess", "setup.exe", "shell.php", "main.exe.gz", "x.br"])(
    "serves %s as plain bytes",
    (path) => {
      expect(servedTypeFor(path)).toEqual(PLAIN_BYTES);
    },
  );

  // The table is a plain object, so a name ending in a key every object inherits must not be mistaken for a
  // known extension.
  it.each([
    "main.js.constructor",
    "page.html.__proto__",
    "a.js.toString",
    "a.hasownproperty",
    "x.constructor.gz",
    "x.__proto__.br",
  ])("serves the inherited key in %s as plain bytes", (path) => {
    expect(servedTypeFor(path)).toEqual(PLAIN_BYTES);
  });

  it("knows the web's usual files, and no others", () => {
    expect(Object.keys(CONTENT_TYPES).sort()).toEqual(
      [
        ...[
          "html",
          "htm",
          "js",
          "mjs",
          "css",
          "json",
          "map",
          "webmanifest",
          "wasm",
          "txt",
          "md",
          "toml",
          "atlas",
          "fnt",
        ],
        ...["png", "jpg", "jpeg", "webp", "avif", "gif", "ico", "svg", "ktx2", "glb", "gltf"],
        ...["bin", "basis", "data", "pck", "unityweb"],
        ...["mp3", "ogg", "oga", "opus", "wav", "m4a", "aac", "flac", "mp4", "webm"],
        ...["woff2", "woff", "ttf", "otf"],
      ].sort(),
    );
  });
});
