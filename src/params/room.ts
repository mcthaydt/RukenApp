// The end of `/make/page/<room>`: the five rooms of a maker's page that are one question each. The links have rooms of
// their own (`links` and `links/add`), so they are routes, not words here.
const WORDS: readonly string[] = ["address", "name", "about", "photo", "colours"];

export function match(param: string): boolean {
  return WORDS.includes(param);
}
