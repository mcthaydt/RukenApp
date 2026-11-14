/** Which copy of Ruken a Worker is: the test copy, filled with made-up content, or the live one people use. */
export type Copy = "test" | "live";

/** The copy this Worker is, from RUKEN_COPY. */
export function readCopy(source: Readonly<Record<string, string | undefined>> = process.env): Copy {
  void source;
  throw new Error("not built yet");
}
