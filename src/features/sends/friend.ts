/** A friend's face in the share sheet: their page's address, its name, and its photo's address when it has one. */
export interface Friend {
  handle: string;
  name: string;
  photo: string | null;
}
