// Sharing a game from the feed: the device's own share sheet where it has one, the link copied where it does not, and the
// address to copy by hand as the last way. The device's two tools are handed in, so a test needs no browser.

/** The two tools a browser may give: its share sheet and its clipboard. */
export interface ShareTools {
  share?: ((data: { title: string; url: string }) => Promise<void>) | undefined;
  copy?: ((text: string) => Promise<void>) | undefined;
}

/**
 * What happened: the sheet was used (`shared`), the person closed it and wants nothing said (`closed`), the link went
 * to the clipboard (`copied`), or nothing worked and they are told where to copy it from (`manual`).
 */
export type ShareResult = "shared" | "closed" | "copied" | "manual";

/** A person closing the share sheet is an answer, not a failure. */
function isClosed(failure: unknown): boolean {
  return (
    typeof failure === "object" && failure !== null && "name" in failure && failure.name === "AbortError"
  );
}

export async function shareLink(
  tools: ShareTools,
  link: { title: string; url: string },
): Promise<ShareResult> {
  if (tools.share !== undefined) {
    try {
      await tools.share(link);
      return "shared";
    } catch (failure) {
      if (isClosed(failure)) return "closed";
      // Any other failure of the sheet falls through to the clipboard.
    }
  }
  if (tools.copy !== undefined) {
    try {
      await tools.copy(link.url);
      return "copied";
    } catch {
      return "manual";
    }
  }
  return "manual";
}
