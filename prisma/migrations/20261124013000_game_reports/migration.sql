-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('sexual', 'gambling', 'ads', 'hateful', 'copied', 'broken', 'other');

-- CreateTable
CREATE TABLE "GameReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "madeAt" TIMESTAMPTZ NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GameReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameReport_gameId_idx" ON "GameReport"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameReport_userId_gameId_key" ON "GameReport"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A note is 500 characters at most (src/features/moderation/reasons.ts). Prisma cannot say so; covered by tests/features/moderation/reports.pg.test.ts.
ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_note_length" CHECK (char_length("note") <= 500);
