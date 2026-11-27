/** One person on the list of people stopped: the stop's id, for Undo, and their page's name (null when it has gone). */
export interface StoppedPerson {
  id: string;
  name: string | null;
}
