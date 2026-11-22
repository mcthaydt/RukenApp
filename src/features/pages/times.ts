// Counts as a person says them. Pure, so a screen and a test say the same thing.

/** "1 time", "12 times", "1,204 times": the commas are always the English ones, whatever the machine's language. */
export function timesWords(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "time" : "times"}`;
}

/** What a page's links come to, for its row: "No links yet", "1 link", "3 links". */
export function linksWords(count: number): string {
  if (count === 0) return "No links yet";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "link" : "links"}`;
}
