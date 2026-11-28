-- CreateEnum
CREATE TYPE "ParentAnswer" AS ENUM ('yes', 'no');

-- CreateTable
CREATE TABLE "ParentAsk" (
    "id" TEXT NOT NULL,
    "teenUserId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "askedAt" TIMESTAMPTZ NOT NULL,
    "answeredAt" TIMESTAMPTZ,
    "answer" "ParentAnswer",
    "revokedAt" TIMESTAMPTZ,

    CONSTRAINT "ParentAsk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentAsk_tokenHash_key" ON "ParentAsk"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentAsk_teenUserId_askedAt_idx" ON "ParentAsk"("teenUserId", "askedAt");

-- AddForeignKey
ALTER TABLE "ParentAsk" ADD CONSTRAINT "ParentAsk_teenUserId_fkey" FOREIGN KEY ("teenUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
