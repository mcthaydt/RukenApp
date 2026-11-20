-- Decision days: new games' decisions are held and go out together on one day a week, with a number of seats.
-- Nothing a maker or staff sees changes with this migration; the hold and the release come in a later one.

-- CreateEnum
CREATE TYPE "DecisionResult" AS ENUM ('applied', 'lapsed');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "acceptedSeenAt" TIMESTAMPTZ,
ADD COLUMN     "changedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "GameReview" ADD COLUMN     "goesOutOn" DATE;

-- CreateTable
CREATE TABLE "DecisionDay" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "seats" INTEGER NOT NULL,
    "wentOutAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionOutcome" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "result" "DecisionResult" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisionDay_day_key" ON "DecisionDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionOutcome_reviewId_key" ON "DecisionOutcome"("reviewId");

-- AddForeignKey
ALTER TABLE "DecisionOutcome" ADD CONSTRAINT "DecisionOutcome_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GameReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/games/schema.pg.test.ts covers each, and decision-days-migration.pg.test.ts the backfill.

-- A day has between 1 and 500 seats (the most the schedule ever gives).
ALTER TABLE "DecisionDay" ADD CONSTRAINT "DecisionDay_seats_check" CHECK ("seats" BETWEEN 1 AND 500);

-- Facts that are only ever added. The function is the one the membership migration made. GameReview already has
-- the trigger, which is what keeps "goesOutOn" from changing once a decision is made.
CREATE TRIGGER "DecisionDay_append_only" BEFORE UPDATE OR DELETE ON "DecisionDay"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('DecisionDay');
CREATE TRIGGER "DecisionOutcome_append_only" BEFORE UPDATE OR DELETE ON "DecisionOutcome"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('DecisionOutcome');

-- Every game that was ever accepted took effect before this migration (no decision is held yet), so none of them
-- should show the Accepted screen: mark each as seen, taken-off and sent-back-then-accepted games included.
UPDATE "Game" SET "acceptedSeenAt" = now()
WHERE EXISTS (
    SELECT 1 FROM "GameReview" WHERE "GameReview"."gameId" = "Game"."id" AND "GameReview"."decision" = 'accepted'
);
