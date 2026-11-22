import { fail } from "@sveltejs/kit";
import {
  authServices,
  computersOf,
  removeComputer,
  renameComputer,
  signedInOnly,
} from "../../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Your computers": every computer that can act for the maker, each with Rename and Remove. Removing takes effect on the
// next request that computer makes.

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const computers = await computersOf(authServices().computerDeps, userId);
  return {
    computers: computers.map((computer) => ({
      id: computer.id,
      name: computer.name,
      addedOn: computer.createdAt.toISOString().slice(0, 10),
      lastUsedOn: computer.lastUsedAt.toISOString().slice(0, 10),
    })),
  };
};

async function idAndName(request: Request): Promise<{ id: string; name: string }> {
  const form = await request.formData();
  const id = form.get("id");
  const name = form.get("name");
  return { id: typeof id === "string" ? id : "", name: typeof name === "string" ? name : "" };
}

export const actions: Actions = {
  rename: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const { id, name } = await idAndName(request);
    const done = await renameComputer(authServices().computerDeps, userId, id, name);
    return done ? { renamed: id } : fail(400, { problem: "Type a name for it first.", id });
  },
  remove: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const { id } = await idAndName(request);
    await removeComputer(authServices().computerDeps, userId, id);
    return { removed: true };
  },
};
