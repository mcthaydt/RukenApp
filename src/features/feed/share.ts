// Sharing a game: Ruken's own share sheet (the owner, 2026-11-24: "our share uses native and not a custom share"). The
// sheet copies the link, opens a messaging app with the link in it, or hands over to the phone's own share sheet as
// "More". The device's tools are handed in, so a test needs no browser.

/** The two tools a browser may give: its share sheet and its clipboard. */
export interface ShareTools {
  share?: ((data: { title: string; url: string }) => Promise<void>) | undefined;
  copy?: ((text: string) => Promise<void>) | undefined;
}

/** What a screen holds of its Share sheet (`bind:this`): the one way to open it. */
export interface ShareSheetControl {
  open(game: { slug: string; name: string }, from: HTMLElement | null): void;
}

/** A game to share: its name and its page's full address. */
export interface ShareLink {
  title: string;
  url: string;
}

/** An app the sheet can open with the link already written in, or, where the app has no way to be handed words, with
 *  the link copied first so it can be pasted there (`pasteFirst`). */
export interface ShareTarget {
  key: "text" | "whatsapp" | "instagram" | "x";
  words: string;
  href: string;
  pasteFirst?: true;
}

/** What the person is asked to do with the link, in words they would say. */
export const messageFor = (link: ShareLink): string => `Play ${link.title} on Ruken`;

/** The apps, in the order people reach for them: a text, WhatsApp, Instagram, then X. Facebook made way for Instagram
 *  (the owner, 2026-11-24: "Replace Facebook with Whatsapp", after "Replace whatsapp with instagram"); Email made way
 *  for Ruken's own Your turn, which the sheet puts before X (the owner, 2026-11-27 14:48 UTC). */
export function shareTargets(link: ShareLink): ShareTarget[] {
  const message = messageFor(link);
  const both = encodeURIComponent(`${message} ${link.url}`);
  return [
    // `sms:?&body=` is the form both iPhone and Android read.
    { key: "text", words: "Text", href: `sms:?&body=${both}` },
    { key: "whatsapp", words: "WhatsApp", href: `https://wa.me/?text=${both}` },
    // Instagram has no address that writes a message in, so
    // the sheet copies the link and opens Instagram's messages, where it is pasted. On a phone with the app, this
    // address opens the app.
    {
      key: "instagram",
      words: "Instagram",
      href: "https://www.instagram.com/direct/inbox/",
      pasteFirst: true,
    },
    {
      key: "x",
      words: "X",
      href: `https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link.url)}`,
    },
  ];
}

/** Whether the link reached the clipboard, or the person has to copy it by hand. */
export async function copyLink(tools: ShareTools, url: string): Promise<"copied" | "manual"> {
  if (tools.copy === undefined) return "manual";
  try {
    await tools.copy(url);
    return "copied";
  } catch {
    return "manual";
  }
}

/** A person closing the phone's share sheet is an answer, not a failure. */
function isClosed(failure: unknown): boolean {
  return (
    typeof failure === "object" && failure !== null && "name" in failure && failure.name === "AbortError"
  );
}

/** The phone's own share sheet, behind "More": used, closed by the person, or broken. */
export async function shareByPhone(
  tools: ShareTools,
  link: ShareLink,
): Promise<"shared" | "closed" | "failed"> {
  if (tools.share === undefined) return "failed";
  try {
    await tools.share(link);
    return "shared";
  } catch (failure) {
    return isClosed(failure) ? "closed" : "failed";
  }
}
