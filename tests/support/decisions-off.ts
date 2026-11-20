import { decisionSchedule, type DecisionSchedule } from "../../src/features/games/seats.ts";

/** The decision day schedule with the ritual off: a yes or a send back takes effect at once, as these tests expect. */
export const decisionsOff: DecisionSchedule = { ...decisionSchedule, firstDay: null };
