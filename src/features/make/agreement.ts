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

/** The agreement read from its file, ready to be set as a numbered list. */
export interface ParsedAgreement {
  version: string;
  /** The date the file's title line carries ("14 November 2026"), or null when it carries none. */
  updated: string | null;
  points: AgreementPoint[];
}

/** The file's first line: its title and version, and the date of the version when the file carries one. */
const TITLE_LINE = /^Ruken maker agreement, version (\d+)(?:, (\d{1,2} [A-Z][a-z]+ \d{4}))?$/;

/** A numbered point starts with its own number and short title ("1. Your game stays yours."), then the point itself. */
const NUMBERED_POINT = /^(\d+)\. ([^.]+\.)\s+(.+)$/;

/**
 * Reads the agreement's file. The words are the file's, untouched: only where they sit is worked out here. The date is
 * read from the file's own title line and never from the page or the build, so a new version cannot go up looking old.
 */
export function parseAgreement(text: string): ParsedAgreement {
  const [first = "", ...rest] = text.split(/\r?\n/).map((line) => line.trim());
  const title = TITLE_LINE.exec(first);
  if (title === null) {
    throw new Error(
      `The maker agreement must start with its title line, "Ruken maker agreement, version N": ${first}`,
    );
  }
  const points = rest
    .filter((line) => line !== "")
    .map((line): AgreementPoint => {
      const point = NUMBERED_POINT.exec(line);
      if (point === null) throw new Error(`A line of the maker agreement is not a numbered point: ${line}`);
      return { number: Number(point[1]), title: point[2] ?? "", body: point[3] ?? "" };
    });
  return { version: title[1] ?? "", updated: title[2] ?? null, points };
}
