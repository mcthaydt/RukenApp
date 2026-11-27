-- CreateTable
CREATE TABLE "MakerFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "makerId" TEXT NOT NULL,
    "followedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MakerFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MakerFollow_makerId_idx" ON "MakerFollow"("makerId");

-- CreateIndex
CREATE UNIQUE INDEX "MakerFollow_followerId_makerId_key" ON "MakerFollow"("followerId", "makerId");

-- AddForeignKey
ALTER TABLE "MakerFollow" ADD CONSTRAINT "MakerFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakerFollow" ADD CONSTRAINT "MakerFollow_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Nobody follows themselves (src/features/pages/follows.ts refuses it first). Prisma cannot say so; covered by tests/features/pages/follows.pg.test.ts.
ALTER TABLE "MakerFollow" ADD CONSTRAINT "MakerFollow_not_self" CHECK ("followerId" <> "makerId");
