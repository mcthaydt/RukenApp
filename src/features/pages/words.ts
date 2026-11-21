// Counts, in the words a person says them.

/** "1 time", "12 times", "1,204 times". The comma is always a comma, so a page reads the same in every browser. */
export function timesWords(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "time" : "times"}`;
}

/** What a maker's links add up to, for the row that opens them. */
export function linksWords(count: number): string {
  if (count === 0) return "No links yet";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "link" : "links"}`;
}
