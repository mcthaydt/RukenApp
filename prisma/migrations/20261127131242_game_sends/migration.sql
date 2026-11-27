-- CreateTable
CREATE TABLE "GameSend" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ NOT NULL,
    "seenAt" TIMESTAMPTZ,

    CONSTRAINT "GameSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendStop" (
    "id" TEXT NOT NULL,
    "stopperId" TEXT NOT NULL,
    "stoppedId" TEXT NOT NULL,
    "stoppedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SendStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSend_toId_sentAt_idx" ON "GameSend"("toId", "sentAt");

-- CreateIndex
CREATE INDEX "GameSend_gameId_idx" ON "GameSend"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSend_fromId_toId_gameId_key" ON "GameSend"("fromId", "toId", "gameId");

-- CreateIndex
CREATE INDEX "SendStop_stoppedId_idx" ON "SendStop"("stoppedId");

-- CreateIndex
CREATE UNIQUE INDEX "SendStop_stopperId_stoppedId_key" ON "SendStop"("stopperId", "stoppedId");

-- AddForeignKey
ALTER TABLE "GameSend" ADD CONSTRAINT "GameSend_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSend" ADD CONSTRAINT "GameSend_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSend" ADD CONSTRAINT "GameSend_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendStop" ADD CONSTRAINT "SendStop_stopperId_fkey" FOREIGN KEY ("stopperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendStop" ADD CONSTRAINT "SendStop_stoppedId_fkey" FOREIGN KEY ("stoppedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Nobody sends to or stops themselves (src/features/sends/ refuses it first). Prisma cannot say so; covered by
-- tests/features/sends/sends.pg.test.ts.
ALTER TABLE "GameSend" ADD CONSTRAINT "GameSend_not_self" CHECK ("fromId" <> "toId");
ALTER TABLE "SendStop" ADD CONSTRAINT "SendStop_not_self" CHECK ("stopperId" <> "stoppedId");
