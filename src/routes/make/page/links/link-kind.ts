// What kind of link the first question chose, read the same way when adding a link and when changing one.

export type LinkKind = "link" | "game_elsewhere" | "social";

/** The choices on the first question, beside the link's words. Each stands alone: choosing one unticks the other. */
export const KIND_CHOICES = [
  { value: "game_elsewhere", title: "A game somewhere else" },
  { value: "social", title: "A small icon, for YouTube, Discord and the like" },
];

/**
 * The kind from the form's ticked choices: none is a plain link. Without script both can arrive ticked; the icon wins,
 * since the next question then says plainly if the address is not one it has an icon for.
 */
export function kindOfForm(data: FormData): LinkKind {
  const ticked = data.getAll("kind");
  if (ticked.includes("social")) return "social";
  if (ticked.includes("game_elsewhere")) return "game_elsewhere";
  return "link";
}

/** The kind as it rides in the second question's address, where anything else is a plain link. */
export function kindOfParam(value: string | null): LinkKind {
  return value === "social" || value === "game_elsewhere" ? value : "link";
}
