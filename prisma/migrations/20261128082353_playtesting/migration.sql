-- CreateEnum
CREATE TYPE "PlaytestState" AS ENUM ('asked', 'in', 'declined', 'removed');

-- CreateEnum
CREATE TYPE "PlaytestVia" AS ENUM ('ask', 'invite', 'link');

-- AlterEnum
ALTER TYPE "PlayBasis" ADD VALUE 'playtest';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "playtestAsking" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Playtester" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "PlaytestState" NOT NULL,
    "via" "PlaytestVia" NOT NULL,
    "askedAt" TIMESTAMPTZ,
    "decidedAt" TIMESTAMPTZ,
    "takenBackAt" TIMESTAMPTZ,
    "noticeAt" TIMESTAMPTZ,
    "noticeSeenAt" TIMESTAMPTZ,
    "noticeGoneAt" TIMESTAMPTZ,

    CONSTRAINT "Playtester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaytestLink" (
    "gameId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "madeAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PlaytestLink_pkey" PRIMARY KEY ("gameId")
);

-- CreateIndex
CREATE INDEX "Playtester_userId_idx" ON "Playtester"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Playtester_gameId_userId_key" ON "Playtester"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaytestLink_token_key" ON "PlaytestLink"("token");

-- AddForeignKey
ALTER TABLE "Playtester" ADD CONSTRAINT "Playtester_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playtester" ADD CONSTRAINT "Playtester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaytestLink" ADD CONSTRAINT "PlaytestLink_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot say these; covered by tests/features/playtest/playtest.pg.test.ts. An ask always has its time, and a
-- link's token is 22 characters of base64url (128 random bits).
ALTER TABLE "Playtester" ADD CONSTRAINT "Playtester_asked_check" CHECK ("state" <> 'asked' OR "askedAt" IS NOT NULL);
ALTER TABLE "PlaytestLink" ADD CONSTRAINT "PlaytestLink_token_check" CHECK ("token" ~ '^[A-Za-z0-9_-]{22}$');
