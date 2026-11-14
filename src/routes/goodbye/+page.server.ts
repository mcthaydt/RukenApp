import { longDay } from "../../lib/long-date.ts";
import type { PageServerLoad } from "./$types";

// Where "Delete my account" ends. The day comes in the address (`?on=2026-11-27`), written there by the delete page,
// and is shown only if it is a real day: anything else shows the page without the date line.
export const load: PageServerLoad = ({ url }) => {
  const on = url.searchParams.get("on");
  return { date: on === null ? null : longDay(on) };
};
