// What a screen may import from the consent feature. Browser-safe: no server code is reachable from here.
export { answerAsk, askForYes, consentAsk, type AskReason } from "./ask.svelte.ts";
export { deviceStore, forgetThisDevice, hasAgreed, setAgreed } from "./device-store.ts";
