export interface ByteRange {
  offset: number;
  length: number;
}

export function parseRange(header: string | null, size: number): ByteRange | "none" | "unsatisfiable" {
  throw new Error(`not built yet: ${String(header)} ${String(size)}`);
}

export function matchesEtag(header: string | null, etag: string): boolean {
  throw new Error(`not built yet: ${String(header)} ${etag}`);
}
