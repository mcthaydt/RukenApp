import type { PrismaClient } from "../../src/lib/server/db.ts";

let made = 0;

/** Makes a person with an address nobody else in the test file has, and answers their id. */
export async function createUser(prisma: PrismaClient): Promise<string> {
  made += 1;
  const user = await prisma.user.create({
    data: { name: "Person", email: `person-${String(made)}@example.test` },
  });
  return user.id;
}
