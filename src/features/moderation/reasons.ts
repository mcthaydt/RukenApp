// What a player can say is wrong with a game, in the words they see, and the reading of what a report sends. Browser-safe:
// the sheet shows these words, and the server reads the same list.

/** The reasons, in the order the sheet shows them. The owner's rule (no pornography, gambling or ads) comes first. */
export const REPORT_REASONS = ["sexual", "gambling", "ads", "hateful", "copied", "broken", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REASON_WORDS: Readonly<Record<ReportReason, string>> = {
  sexual: "Sexual content",
  gambling: "Gambling",
  ads: "Ads",
  hateful: "Hate or bullying",
  copied: "Copied from someone else",
  broken: "It doesn't work",
  other: "Something else",
};

/** The longest note a report keeps. The table holds it too (GameReport_note_length). */
export const NOTE_MAX = 500;

export interface ReportInput {
  reason: ReportReason;
  /** Null when the person wrote nothing (or only spaces). */
  note: string | null;
}

const isReason = (value: unknown): value is ReportReason =>
  typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);

/** A report from what the sheet sent, or what is wrong with it in words a person can read. */
export function readReport(body: unknown): ReportInput | { problem: string } {
  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (!isReason(fields.reason)) return { problem: "Pick what's wrong." };
  const raw = fields.note ?? "";
  if (typeof raw !== "string") return { problem: "That note can't be read." };
  const note = raw.trim();
  if (Array.from(note).length > NOTE_MAX) return { problem: `Keep it under ${String(NOTE_MAX)} letters.` };
  return { reason: fields.reason, note: note === "" ? null : note };
}
