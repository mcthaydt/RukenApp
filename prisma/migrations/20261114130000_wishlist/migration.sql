-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistMail" (
    "userId" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistMail_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Wishlist_gameId_idx" ON "Wishlist"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_gameId_key" ON "Wishlist"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistMail" ADD CONSTRAINT "WishlistMail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express triggers.
-- tests/features/launch/schema.pg.test.ts covers it.

-- A launch email that went out is a fact that is only ever added: a second run of the job finds the row and sends
-- nothing. The function is the one the membership migration made.
CREATE TRIGGER "WishlistMail_append_only" BEFORE UPDATE OR DELETE ON "WishlistMail"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('WishlistMail');
