-- CreateEnum
CREATE TYPE "TasteDirection" AS ENUM ('more', 'less');

-- CreateEnum
CREATE TYPE "TasteKind" AS ENUM ('mood', 'genre', 'maker', 'game');

-- CreateEnum
CREATE TYPE "GoodPickAnswer" AS ENUM ('yes', 'no');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "feedPersonal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "feedResetAt" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "FeedTaste" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "TasteDirection" NOT NULL,
    "kind" "TasteKind" NOT NULL,
    "value" TEXT NOT NULL,
    "makerUserId" TEXT,
    "gameId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FeedTaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodPickAsked" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "askedAt" TIMESTAMPTZ NOT NULL,
    "answer" "GoodPickAnswer",

    CONSTRAINT "GoodPickAsked_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedTaste_makerUserId_idx" ON "FeedTaste"("makerUserId");

-- CreateIndex
CREATE INDEX "FeedTaste_gameId_idx" ON "FeedTaste"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedTaste_userId_direction_kind_value_key" ON "FeedTaste"("userId", "direction", "kind", "value");

-- CreateIndex
CREATE INDEX "GoodPickAsked_gameId_idx" ON "GoodPickAsked"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodPickAsked_userId_gameId_key" ON "GoodPickAsked"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "FeedTaste" ADD CONSTRAINT "FeedTaste_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTaste" ADD CONSTRAINT "FeedTaste_makerUserId_fkey" FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTaste" ADD CONSTRAINT "FeedTaste_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodPickAsked" ADD CONSTRAINT "GoodPickAsked_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodPickAsked" ADD CONSTRAINT "GoodPickAsked_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A maker chip names its maker and a game chip its game, in `value` and in the column that ties it to them; a mood or
-- genre chip names neither. Prisma cannot say so; covered by tests/features/feed/taste.pg.test.ts.
ALTER TABLE "FeedTaste" ADD CONSTRAINT "FeedTaste_kind_columns" CHECK (
  CASE "kind"
    WHEN 'maker' THEN "makerUserId" IS NOT DISTINCT FROM "value" AND "gameId" IS NULL
    WHEN 'game' THEN "gameId" IS NOT DISTINCT FROM "value" AND "makerUserId" IS NULL
    ELSE "makerUserId" IS NULL AND "gameId" IS NULL
  END
);
