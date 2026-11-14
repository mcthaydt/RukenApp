export const CONTENT_TYPES: Readonly<Record<string, string>> = {};

export interface ServedType {
  readonly contentType: string;
  readonly encoding?: "br" | "gzip";
}

export function servedTypeFor(path: string): ServedType {
  throw new Error(`not built yet: ${path}`);
}
