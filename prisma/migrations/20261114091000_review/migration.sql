-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('accepted', 'sent_back');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "pendingPullId" TEXT,
ADD COLUMN     "pendingSince" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "GameReview" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "pullId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakerAgreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MakerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameReview_gameId_idx" ON "GameReview"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "MakerAgreement_userId_key" ON "MakerAgreement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_pendingPullId_key" ON "Game"("pendingPullId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_pendingPullId_fkey" FOREIGN KEY ("pendingPullId") REFERENCES "GamePull"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_pullId_fkey" FOREIGN KEY ("pullId") REFERENCES "GamePull"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakerAgreement" ADD CONSTRAINT "MakerAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/games/review.pg.test.ts and tests/features/make/agreement.pg.test.ts cover each.

-- A game sent back says what to fix, in 1 to 500 characters (after trimming, which the service does).
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_reason_check"
    CHECK ("decision" <> 'sent_back' OR ("reason" IS NOT NULL AND char_length("reason") BETWEEN 1 AND 500));

-- Facts that are only ever added. The function is the one the membership migration made.
CREATE TRIGGER "GameReview_append_only" BEFORE UPDATE OR DELETE ON "GameReview"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('GameReview');
CREATE TRIGGER "MakerAgreement_append_only" BEFORE UPDATE OR DELETE ON "MakerAgreement"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('MakerAgreement');
