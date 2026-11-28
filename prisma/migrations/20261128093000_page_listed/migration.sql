-- A page sign-up makes from a person's name is unlisted. Every page made before this is listed, as the default says.
-- AlterTable
ALTER TABLE "MakerPage" ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT true;
