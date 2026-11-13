import { AsyncLocalStorage } from "node:async_hooks";
import type { Handle } from "@sveltejs/kit/hooks";

/** Starts work that may finish after the answer has gone out. The task never throws. */
export type RunInBackground = (task: () => Promise<void>) => void;

// Work that runs after the answer has gone out: the reset and password-changed mails and the
// sign-in pause notice. They wait until after the answer on purpose, so the answer's timing does
// not show whether an address has an account.
//
// On a long-lived server a started promise simply runs to the end. On Netlify Functions the instance
// can be frozen as soon as the answer is returned, and a mail half sent is lost. Netlify gives each
// request a `waitUntil` that keeps the instance running until a promise settles; the answer has
// already gone, so the timing protection holds.
//
// better-auth is built once per process, but `waitUntil` belongs to one request. So the hook below
// keeps the current request's `waitUntil` in an AsyncLocalStorage around everything the request does,
// and `runAfterAnswer` finds it there. AsyncLocalStorage follows `await`s, so a form action or the
// /api/auth route that calls better-auth still sees its own request's `waitUntil`.

type WaitUntil = (promise: Promise<unknown>) => void;

const currentWaitUntil = new AsyncLocalStorage<WaitUntil | undefined>();

/**
 * The platform's `waitUntil` for this request, or undefined (a long-lived server, tests). SvelteKit
 * types `platform` per adapter, so it is read as unknown. It is called through its context object,
 * which Netlify's implementation needs.
 */
function waitUntilOf(platform: unknown): WaitUntil | undefined {
  const context = (platform as { context?: { waitUntil?: unknown } } | undefined)?.context;
  if (context === undefined || typeof context.waitUntil !== "function") return undefined;
  const waitUntil = context.waitUntil as (this: unknown, promise: Promise<unknown>) => void;
  return (promise) => {
    waitUntil.call(context, promise);
  };
}

/** Runs the request inside its platform's `waitUntil`. First in hooks.server.ts, so every route and form is inside it. */
export const keepBackgroundWorkAlive: Handle = ({ event, resolve }) =>
  currentWaitUntil.run(waitUntilOf(event.platform), () => resolve(event));

/** Starts the task and, when the platform has one, hands it to the request's `waitUntil`. The task never throws. */
export const runAfterAnswer: RunInBackground = (task) => {
  const work = task();
  currentWaitUntil.getStore()?.(work);
};
