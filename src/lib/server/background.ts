import type { Handle } from "@sveltejs/kit/hooks";

/** Starts work that may finish after the answer has gone out. The task never throws. */
export type RunInBackground = (task: () => Promise<void>) => void;

/** Runs the request inside its platform's `waitUntil`. */
export const keepBackgroundWorkAlive: Handle = () => {
  throw new Error("not built yet");
};

/** Starts the task and hands it to the request's `waitUntil` when the platform has one. */
export const runAfterAnswer: RunInBackground = () => {
  throw new Error("not built yet");
};
