import { defineConfig } from "prisma/config";

// Prisma 7 reads the connection string from here, not from the schema files.
// Migrations need Neon's direct address (its pooled address cannot run them), so
// DIRECT_DATABASE_URL wins when it is set. `prisma generate` needs no database, so a
// missing address is allowed; `migrate` fails with a clear error when it is empty.
export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "" },
});
