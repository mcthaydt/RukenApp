// A maker's photo: what a file must be to be kept, and where it is kept. Like a clip it is stored in the bucket under
// a key made here, and served to anyone from the media address.

/** 5 MB: more than a phone's photo is once the page has cut it down, and little enough to send on any line. */
export const PHOTO_MAX_BYTES = 5_000_000;

/** The picture types a photo may have, and the file extension each gets in its key. */
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type PhotoContentType = keyof typeof EXTENSIONS;

export function isPhotoContentType(value: string): value is PhotoContentType {
  // `Object.hasOwn`, not `value in`: a plain object also "has" what every object inherits (`constructor`).
  return Object.hasOwn(EXTENSIONS, value);
}

/** Where a photo lives. The random part gives each photo an address of its own, so a browser that kept the old one never shows it for the new one. */
export function photoKeyFor(_random16Hex: string, _contentType: PhotoContentType): string {
  throw new Error("not built yet: photoKeyFor");
}

/** Whether a key is exactly the shape `photoKeyFor` makes. The gate serves a photo only for such a key. */
export function isPhotoKey(_key: string): boolean {
  throw new Error("not built yet: isPhotoKey");
}

/** Whether the bytes start the way a picture of this type must. */
export function looksLikePhoto(_bytes: Uint8Array, _contentType: PhotoContentType): boolean {
  throw new Error("not built yet: looksLikePhoto");
}

/** The words for what is wrong with an upload, or null when it is fine. */
export function photoProblem(_upload: { contentType: string; bytes: Uint8Array }): string | null {
  throw new Error("not built yet: photoProblem");
}
