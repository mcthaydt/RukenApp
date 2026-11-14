type Settings = Record<string, string | undefined>;

export function hasJobSecret(request: Request, source: Settings = process.env): boolean {
  throw new Error(`not built yet: ${request.method} ${typeof source}`);
}
