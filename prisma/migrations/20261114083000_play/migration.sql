-- CreateEnum
CREATE TYPE "PlayBasis" AS ENUM ('member', 'free_game', 'staff', 'own_game');

-- CreateTable
CREATE TABLE "PlayPass" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "pullId" TEXT NOT NULL,
    "userId" TEXT,
    "madeAt" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaySession" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "pullId" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "userId" TEXT,
    "basis" "PlayBasis" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayBeat" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ NOT NULL,
    "attentive" BOOLEAN NOT NULL,

    CONSTRAINT "PlayBeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayPass_gameId_pullId_userId_expiresAt_idx" ON "PlayPass"("gameId", "pullId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PlaySession_userId_startedAt_idx" ON "PlaySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "PlaySession_gameId_startedAt_idx" ON "PlaySession"("gameId", "startedAt");

-- CreateIndex
CREATE INDEX "PlayBeat_sessionId_receivedAt_idx" ON "PlayBeat"("sessionId", "receivedAt");

-- AddForeignKey
ALTER TABLE "PlayPass" ADD CONSTRAINT "PlayPass_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayPass" ADD CONSTRAINT "PlayPass_pullId_fkey" FOREIGN KEY ("pullId") REFERENCES "GamePull"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayPass" ADD CONSTRAINT "PlayPass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_pullId_fkey" FOREIGN KEY ("pullId") REFERENCES "GamePull"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_passId_fkey" FOREIGN KEY ("passId") REFERENCES "PlayPass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayBeat" ADD CONSTRAINT "PlayBeat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/play/schema.pg.test.ts covers every one.

-- A pass's own id: 22 characters of base64url (16 random bytes).
ALTER TABLE "PlayPass" ADD CONSTRAINT "PlayPass_id_check"
    CHECK ("id" ~ '^[A-Za-z0-9_-]{22}$');

-- A pass runs out after it was made.
ALTER TABLE "PlayPass" ADD CONSTRAINT "PlayPass_time_check"
    CHECK ("expiresAt" > "madeAt");

-- The token's hash: SHA-256 in 64 lower-case hex characters. The token itself is never stored.
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_tokenHash_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

-- Only a free game is played by nobody.
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_basis_check"
    CHECK ("userId" IS NOT NULL OR "basis" = 'free_game');

-- Facts that are only ever added. The function is the one the membership migration made.
CREATE TRIGGER "PlayPass_append_only" BEFORE UPDATE OR DELETE ON "PlayPass"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PlayPass');
CREATE TRIGGER "PlaySession_append_only" BEFORE UPDATE OR DELETE ON "PlaySession"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PlaySession');
CREATE TRIGGER "PlayBeat_append_only" BEFORE UPDATE OR DELETE ON "PlayBeat"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PlayBeat');
