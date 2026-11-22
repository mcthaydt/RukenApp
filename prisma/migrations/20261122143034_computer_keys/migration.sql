-- CreateTable
CREATE TABLE "ComputerKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComputerKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComputerSignIn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "deviceSecretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedFrom" TEXT,
    "userId" TEXT,
    "answer" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComputerSignIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComputerKey_keyHash_key" ON "ComputerKey"("keyHash");

-- CreateIndex
CREATE INDEX "ComputerKey_userId_idx" ON "ComputerKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ComputerSignIn_code_key" ON "ComputerSignIn"("code");

-- CreateIndex
CREATE INDEX "ComputerSignIn_expiresAt_idx" ON "ComputerSignIn"("expiresAt");

-- AddForeignKey
ALTER TABLE "ComputerKey" ADD CONSTRAINT "ComputerKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputerSignIn" ADD CONSTRAINT "ComputerSignIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
