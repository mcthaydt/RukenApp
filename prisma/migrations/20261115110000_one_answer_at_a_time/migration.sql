-- A game is answered one question at a time, so its answers may be empty until it is sent; a game thrown away
-- is kept as a row; and a game sent back says why part by part, in rows of their own.

-- AlterEnum
ALTER TYPE "GameState" ADD VALUE 'thrown_away';

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "oneLine" DROP NOT NULL,
ALTER COLUMN "playsOn" DROP NOT NULL,
ALTER COLUMN "repoFullName" DROP NOT NULL;

-- The one reason of a whole review gives way to a reason for each part. The table exists only on this branch, so no
-- decision that was recorded is lost. The check goes first, by name, though dropping the column would take it too.
ALTER TABLE "GameReview" DROP CONSTRAINT "GameReview_reason_check";

-- AlterTable
ALTER TABLE "GameReview" DROP COLUMN "reason";

-- CreateTable
CREATE TABLE "GameReviewPart" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "part" "GamePart" NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReviewPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameReviewPart_reviewId_part_key" ON "GameReviewPart"("reviewId", "part");

-- AddForeignKey
ALTER TABLE "GameReviewPart" ADD CONSTRAINT "GameReviewPart_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GameReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/games/schema.pg.test.ts covers each.

-- A game past `draft` has every answer. It is written with the old state names on purpose: Postgres refuses to use an
-- enum value in the same transaction that adds it, and `thrown_away` needs no answers.
ALTER TABLE "Game" ADD CONSTRAINT "Game_answered_check"
    CHECK (
        "state" NOT IN ('waiting', 'live', 'sent_back', 'taken_off', 'taken_down')
        OR (
            "oneLine" IS NOT NULL
            AND "playsOn" IS NOT NULL
            AND "repoFullName" IS NOT NULL
            AND "ageRating" IS NOT NULL
            AND ("ageRating" <> 'age_18' OR cardinality("contentMarks") > 0)
        )
    );

-- Staff's own line is 1 to 500 characters, and a reason of "Something else" is nothing without it.
ALTER TABLE "GameReviewPart" ADD CONSTRAINT "GameReviewPart_note_check"
    CHECK (
        ("note" IS NULL OR char_length("note") BETWEEN 1 AND 500)
        AND ("reason" <> 'something_else' OR "note" IS NOT NULL)
    );

-- A part sent back is a fact that is only ever added. The function is the one the membership migration made.
CREATE TRIGGER "GameReviewPart_append_only" BEFORE UPDATE OR DELETE ON "GameReviewPart"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('GameReviewPart');
