-- CreateEnum
CREATE TYPE "ParentAnswer" AS ENUM ('yes', 'no');

-- CreateTable
CREATE TABLE "ParentYes" (
    "id" TEXT NOT NULL,
    "teenUserId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "askedAt" TIMESTAMPTZ NOT NULL,
    "answeredAt" TIMESTAMPTZ,
    "answer" "ParentAnswer",
    "revokedAt" TIMESTAMPTZ,

    CONSTRAINT "ParentYes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentYes_tokenHash_key" ON "ParentYes"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentYes_teenUserId_askedAt_idx" ON "ParentYes"("teenUserId", "askedAt");

-- AddForeignKey
ALTER TABLE "ParentYes" ADD CONSTRAINT "ParentYes_teenUserId_fkey" FOREIGN KEY ("teenUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
