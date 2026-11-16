-- CreateEnum
CREATE TYPE "MakerActionKind" AS ENUM ('taken_off', 'put_back');

-- CreateTable
CREATE TABLE "MakerAction" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "MakerActionKind" NOT NULL,
    "at" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MakerAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MakerAction_gameId_idx" ON "MakerAction"("gameId");

-- AddForeignKey
ALTER TABLE "MakerAction" ADD CONSTRAINT "MakerAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakerAction" ADD CONSTRAINT "MakerAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express triggers. tests/features/games/take-off.pg.test.ts covers it.

-- Facts that are only ever added. The function is the one the membership migration made.
CREATE TRIGGER "MakerAction_append_only" BEFORE UPDATE OR DELETE ON "MakerAction"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('MakerAction');
