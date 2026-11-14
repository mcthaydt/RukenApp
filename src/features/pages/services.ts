import { prisma } from "../../lib/server/db.ts";
import { fileStore } from "../../lib/server/files.ts";
import { createPagesService, type PagesService } from "./service.ts";

// Everything the pages feature needs, built once per server process. Routes call pagesServices(); tests build their
// own service with createPagesService and a database of their own.

export interface PagesServices {
  service: PagesService;
}

let shared: PagesServices | undefined;

/** The process-wide pages services, created on first use. */
export function pagesServices(): PagesServices {
  shared ??= { service: createPagesService({ db: prisma(), files: fileStore() }) };
  return shared;
}
