import { platform } from "./platform.ts";

/** Starts work that may finish after the answer has gone out. The task never throws. */
export type RunInBackground = (task: () => Promise<void>) => void;

// Work that runs after the answer has gone out: the reset and password-changed mails and the
// sign-in pause notice. They wait until after the answer on purpose, so the answer's timing does
// not show whether an address has an account.
//
// A Worker can be stopped as soon as the answer is returned, and a mail half sent is lost. The platform's
// `waitUntil` keeps it running until a promise settles; the answer has already gone, so the timing
// protection holds. On Cloudflare `waitUntil` already belongs to the request that is running, so nothing
// has to carry it from the hook to here.

/** Starts the task and hands it to the platform, so the host waits for it. The task never throws. */
export const runAfterAnswer: RunInBackground = (task) => {
  platform().waitUntil(task());
};
