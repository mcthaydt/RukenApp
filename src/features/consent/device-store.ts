// The only place Ruken's own code touches the browser's storage (a test fails if `localStorage` or `sessionStorage`
// shows up anywhere else in src/). Until this browser has agreed it keeps values in memory for the visit, so a hint
// that was shown stays hidden while the person moves around, and nothing is written to the device.

/** What a screen kept this visit, and, once this browser agreed, what the device also holds. */
const memory = new Map<string, string>();
let agreed = false;

/** Whether this browser has said yes to cookies, as the layout last said: a press that keeps something asks first. */
export function hasAgreed(): boolean {
  return agreed;
}

/** The layout says whether this browser agreed, on every load, and again when the person answers. */
export function setAgreed(value: boolean): void {
  agreed = value;
  if (value) restoreSessionStorage();
}

export const deviceStore = {
  get(key: string): string | null {
    const kept = memory.get(key);
    if (kept !== undefined || !agreed) return kept ?? null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    if (!agreed) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // A browser that refuses storage keeps the value for this visit only.
    }
  },
};

interface StorageStandIn {
  restore(): void;
  hold(): void;
}

/** The stand-in for sessionStorage that app.html puts up before any script runs (see there). */
function standIn(): StorageStandIn | undefined {
  return (window as unknown as { __rkStorage?: StorageStandIn }).__rkStorage;
}

/** Called once this browser agreed: sessionStorage is the real one again. */
export function restoreSessionStorage(): void {
  if (typeof window !== "undefined") standIn()?.restore();
}

/** Called when the yes is taken back: every `rk_` key leaves this device and sessionStorage is the stand-in again. */
export function forgetThisDevice(): void {
  memory.clear();
  agreed = false;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("rk_")) localStorage.removeItem(key);
    sessionStorage.clear();
  } catch {
    // Nothing is kept where storage is refused.
  }
  standIn()?.hold();
}
