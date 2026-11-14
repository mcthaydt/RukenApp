import type { FileStore } from "../../lib/files/store.ts";

export interface GateDeps {
  files: FileStore;
  passSecret: string;
  siteOrigin: string;
  nowMs: number;
}

export function handleGameRequest(request: Request, deps: GateDeps): Promise<Response> {
  throw new Error(`not built yet: ${request.url} ${deps.siteOrigin}`);
}
