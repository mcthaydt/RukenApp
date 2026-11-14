-- CreateEnum
CREATE TYPE "PoolShareKind" AS ENUM ('play', 'bringing');

-- CreateEnum
CREATE TYPE "StatementLineSource" AS ENUM ('play', 'bringing', 'transfer', 'payout_cost', 'correction');

-- CreateTable
CREATE TABLE "PoolRun" (
    "period" TEXT NOT NULL,
    "poolCents" BIGINT NOT NULL,
    "carryCents" BIGINT NOT NULL,
    "members" INTEGER NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "sharedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolRun_pkey" PRIMARY KEY ("period")
);

-- CreateTable
CREATE TABLE "PoolShare" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" "PoolShareKind" NOT NULL,
    "makerUserId" TEXT NOT NULL,
    "gameId" TEXT,
    "weight" BIGINT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "seconds" INTEGER,
    "members" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "makerUserId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "totalsHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "source" "StatementLineSource" NOT NULL,
    "gameId" TEXT,
    "ref" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoolShare_makerUserId_idx" ON "PoolShare"("makerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_makerUserId_period_key" ON "Statement"("makerUserId", "period");

-- CreateIndex
CREATE INDEX "StatementLine_statementId_idx" ON "StatementLine"("statementId");

-- AddForeignKey
ALTER TABLE "PoolRun" ADD CONSTRAINT "PoolRun_period_fkey" FOREIGN KEY ("period") REFERENCES "LedgerPeriod"("period") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolShare" ADD CONSTRAINT "PoolShare_period_fkey" FOREIGN KEY ("period") REFERENCES "PoolRun"("period") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolShare" ADD CONSTRAINT "PoolShare_makerUserId_fkey" FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolShare" ADD CONSTRAINT "PoolShare_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_makerUserId_fkey" FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_period_fkey" FOREIGN KEY ("period") REFERENCES "LedgerPeriod"("period") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express CHECK constraints, partial unique indexes or triggers.
-- tests/features/money/schema.pg.test.ts covers every one.

-- What a share is for decides what it names: a game's share names the game and the seconds of play that earned it; a
-- bringing bonus names neither, and names the members it is for.
ALTER TABLE "PoolShare" ADD CONSTRAINT "PoolShare_kind_check" CHECK (
    ("kind" = 'play' AND "gameId" IS NOT NULL AND "seconds" IS NOT NULL AND "members" IS NULL)
    OR ("kind" = 'bringing' AND "gameId" IS NULL AND "seconds" IS NULL AND "members" IS NOT NULL));

-- One play share for a game and a month, and one bringing share for a maker and a month. Two partial indexes, because a
-- bringing share has no game and Postgres lets nulls repeat in a plain one.
CREATE UNIQUE INDEX "PoolShare_play_key" ON "PoolShare"("period", "gameId") WHERE "kind" = 'play';
CREATE UNIQUE INDEX "PoolShare_bringing_key" ON "PoolShare"("period", "makerUserId") WHERE "kind" = 'bringing';

-- Facts that are only ever added. The function is the one the membership migration made.
CREATE TRIGGER "PoolRun_append_only" BEFORE UPDATE OR DELETE ON "PoolRun"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PoolRun');
CREATE TRIGGER "PoolShare_append_only" BEFORE UPDATE OR DELETE ON "PoolShare"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PoolShare');
CREATE TRIGGER "Statement_append_only" BEFORE UPDATE OR DELETE ON "Statement"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('Statement');
CREATE TRIGGER "StatementLine_append_only" BEFORE UPDATE OR DELETE ON "StatementLine"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('StatementLine');
