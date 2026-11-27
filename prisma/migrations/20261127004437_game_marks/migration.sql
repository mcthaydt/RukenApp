-- CreateEnum
CREATE TYPE "MarkKind" AS ENUM ('like', 'save', 'repost');

-- CreateTable
CREATE TABLE "GameMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "kind" "MarkKind" NOT NULL,
    "madeAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GameMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameMark_gameId_kind_idx" ON "GameMark"("gameId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "GameMark_userId_gameId_kind_key" ON "GameMark"("userId", "gameId", "kind");

-- AddForeignKey
ALTER TABLE "GameMark" ADD CONSTRAINT "GameMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMark" ADD CONSTRAINT "GameMark_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
