-- CreateEnum
CREATE TYPE "PageLinkKind" AS ENUM ('link', 'game_elsewhere');

-- CreateTable
CREATE TABLE "MakerPage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "oneLine" TEXT NOT NULL DEFAULT '',
    "themeId" INTEGER NOT NULL DEFAULT 0,
    "photoKey" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MakerPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageLink" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "kind" "PageLinkKind" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "taps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PageLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MakerPage_userId_key" ON "MakerPage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MakerPage_handle_key" ON "MakerPage"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "MakerPage_photoKey_key" ON "MakerPage"("photoKey");

-- CreateIndex
CREATE INDEX "PageLink_pageId_position_idx" ON "PageLink"("pageId", "position");

-- AddForeignKey
ALTER TABLE "MakerPage" ADD CONSTRAINT "MakerPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MakerPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: Prisma cannot express CHECK constraints.
-- tests/features/pages/schema.pg.test.ts covers every one.

-- A page's address: lower-case letters and digits in runs joined by single hyphens, 3 to 30 characters.
ALTER TABLE "MakerPage" ADD CONSTRAINT "MakerPage_handle_check"
    CHECK ("handle" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("handle") BETWEEN 3 AND 30);

-- The name on the page: 1 to 40 characters.
ALTER TABLE "MakerPage" ADD CONSTRAINT "MakerPage_name_check"
    CHECK (char_length("name") BETWEEN 1 AND 40);

-- The one line under the name: empty, or 100 characters at most.
ALTER TABLE "MakerPage" ADD CONSTRAINT "MakerPage_oneLine_check"
    CHECK (char_length("oneLine") <= 100);

-- Counts never go below zero, and 0 is the default theme.
ALTER TABLE "MakerPage" ADD CONSTRAINT "MakerPage_counts_check"
    CHECK ("views" >= 0 AND "themeId" >= 0);

-- A link is sent on to only when it is https (the rest of the address is checked in code, before it is kept).
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_url_check"
    CHECK ("url" ~ '^https://' AND char_length("url") <= 500);

-- The words on a link: 1 to 60 characters.
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_title_check"
    CHECK (char_length("title") BETWEEN 1 AND 60);

-- A tap count only ever rises.
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_taps_check"
    CHECK ("taps" >= 0);
