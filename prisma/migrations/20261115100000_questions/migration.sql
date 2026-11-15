-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('age_3', 'age_7', 'age_12', 'age_16', 'age_18');

-- CreateEnum
CREATE TYPE "ContentMark" AS ENUM ('sex_or_nudity', 'gore', 'drugs', 'none');

-- CreateEnum
CREATE TYPE "GamePart" AS ENUM ('name', 'one_line', 'files', 'plays_on', 'upright_video', 'wide_video', 'age_rating', 'other_websites');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "ageRating" "AgeRating",
ADD COLUMN     "contentMarks" "ContentMark"[] DEFAULT ARRAY[]::"ContentMark"[],
ADD COLUMN     "toFix" "GamePart"[] DEFAULT ARRAY[]::"GamePart"[];



-- Hand-written: Prisma cannot express CHECK constraints.
-- tests/features/games/schema.pg.test.ts covers it.

-- Marks belong to an 18+ game only, and "None of these" stands alone. A game with no rating yet has no marks either,
-- which the COALESCE spells out: a bare comparison with a missing rating would be unknown, and a CHECK lets unknown pass.
ALTER TABLE "Game" ADD CONSTRAINT "Game_marks_check"
    CHECK (
        (cardinality("contentMarks") = 0 OR COALESCE("ageRating" = 'age_18', false))
        AND (NOT ('none' = ANY("contentMarks")) OR cardinality("contentMarks") = 1)
    );
