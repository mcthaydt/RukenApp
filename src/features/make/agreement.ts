import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import agreementText from "./library/maker-agreement-v1.txt?raw";

// What a maker has agreed to. The text is the Owner's, kept word for word in library/maker-agreement-v1.txt and shown
// as plain paragraphs. A new version is a new file and a new number; a maker is asked to agree again before the next
// game goes up (the agreement's own last point).

/** The version of the text in `library/maker-agreement-v1.txt`. */
export const MAKER_AGREEMENT_VERSION = "1";

/** The text, as it is in the file. */
export const MAKER_AGREEMENT_TEXT: string = agreementText;

/** True once this maker has agreed. */
export async function hasAgreed(db: PrismaClient, userId: string): Promise<boolean> {
  return (await db.makerAgreement.count({ where: { userId } })) > 0;
}

/**
 * Records that this maker agreed to this version, once: a second call adds nothing. A row is only ever added, so it is
 * written with "do nothing if it is there", not an update.
 */
export async function agree(db: PrismaClient, clock: Clock, userId: string): Promise<void> {
  await db.makerAgreement.createMany({
    data: [{ userId, version: MAKER_AGREEMENT_VERSION, acceptedAt: new Date(clock.epochMs()) }],
    skipDuplicates: true,
  });
}

/** One numbered point of the agreement: its number, its short title, and the point itself. */
export interface AgreementPoint {
  number: number;
  title: string;
  body: string;
}

/** The agreement read from its file. Not built yet. */
export interface ParsedAgreement {
  version: string;
  /** The date the file's title line carries ("14 November 2026"), or null when it carries none. */
  updated: string | null;
  points: AgreementPoint[];
}

export function parseAgreement(text: string): ParsedAgreement {
  throw new Error(`parseAgreement is not built yet (${String(text.length)})`);
}
