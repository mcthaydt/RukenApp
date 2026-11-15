// What the card beside a question shows, and what has been typed or picked since the page came. The page makes one
// (it outlives each question's screen), and the question's answer, the choices and the card all read the same one, so
// the card follows the typing without the answer or the card knowing about each other.
import { getContext, setContext } from "svelte";

/** A game as the card shows it: what is saved. An empty name or line is a part not answered yet. */
export interface SavedPreview {
  name: string;
  oneLine: string;
  /** Who it is for in words ("12+", "18+ · Gore"), or null before it is chosen. */
  rating: string | null;
  /** The upright video's address, or null before there is one. */
  video: string | null;
}

const KEY = Symbol("preview");

/** What the card shows: the saved game, with whatever has been typed or picked on this screen laid over it. */
export class Preview {
  /** Read each time, so a page that loads again (the next question) shows what it saved. */
  readonly #saved: () => SavedPreview;
  #question: string | null = null;
  #typedName = $state<string | null>(null);
  #typedLine = $state<string | null>(null);
  #pickedRating = $state<string | null>(null);

  constructor(saved: () => SavedPreview) {
    this.#saved = saved;
  }

  get name(): string {
    return (this.#typedName ?? this.#saved().name).trim();
  }

  get oneLine(): string {
    return (this.#typedLine ?? this.#saved().oneLine).trim();
  }

  get rating(): string | null {
    return this.#pickedRating ?? this.#saved().rating;
  }

  get video(): string | null {
    return this.#saved().video;
  }

  typeName(words: string): void {
    this.#typedName = words;
  }

  typeLine(words: string): void {
    this.#typedLine = words;
  }

  pickRating(words: string): void {
    this.#pickedRating = words;
  }

  /** Called with the question on screen: a new question starts from what is saved, not from the last one's typing. */
  follow(question: string): void {
    if (question === this.#question) return;
    this.#question = question;
    this.#typedName = null;
    this.#typedLine = null;
    this.#pickedRating = null;
  }
}

/** Makes the page's card and shares it with every part of the question that is under the page. */
export function providePreview(saved: () => SavedPreview): Preview {
  const preview = new Preview(saved);
  setContext(KEY, preview);
  return preview;
}

/** The page's card, or nothing where a screen is used outside a question's page. */
export function previewOfPage(): Preview | undefined {
  return getContext<Preview | undefined>(KEY);
}
