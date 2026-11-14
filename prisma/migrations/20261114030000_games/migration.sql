-- CreateEnum
CREATE TYPE "GamePlaysOn" AS ENUM ('phone_and_computer', 'computer_only');

-- CreateEnum
CREATE TYPE "GameState" AS ENUM ('draft', 'waiting', 'live', 'sent_back', 'taken_off', 'taken_down');

-- CreateEnum
CREATE TYPE "ClipShape" AS ENUM ('upright', 'wide');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "makerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "oneLine" TEXT NOT NULL,
    "playsOn" "GamePlaysOn" NOT NULL,
    "state" "GameState" NOT NULL DEFAULT 'draft',
    "stateReason" TEXT,
    "freeToPlay" BOOLEAN NOT NULL DEFAULT false,
    "repoFullName" TEXT NOT NULL,
    "repoBranch" TEXT,
    "repoFolder" TEXT NOT NULL DEFAULT '',
    "connectHosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "livePullId" TEXT,
    "pullProblem" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePull" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "connectHosts" TEXT[],
    "pulledAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePull_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameClip" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "shape" "ClipShape" NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GameClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_publicId_key" ON "Game"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Game_livePullId_key" ON "Game"("livePullId");

-- CreateIndex
CREATE INDEX "Game_makerUserId_idx" ON "Game"("makerUserId");

-- CreateIndex
CREATE INDEX "GamePull_gameId_idx" ON "GamePull"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameClip_key_key" ON "GameClip"("key");

-- CreateIndex
CREATE UNIQUE INDEX "GameClip_gameId_shape_key" ON "GameClip"("gameId", "shape");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_makerUserId_fkey" FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_livePullId_fkey" FOREIGN KEY ("livePullId") REFERENCES "GamePull"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePull" ADD CONSTRAINT "GamePull_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameClip" ADD CONSTRAINT "GameClip_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/games/schema.pg.test.ts covers every one.

-- A game's own name on the games' domain and in the bucket: ten base32 characters, never changed.
ALTER TABLE "Game" ADD CONSTRAINT "Game_publicId_check"
    CHECK ("publicId" ~ '^[a-z2-7]{10}$');

-- A page's address: lower-case letters and digits in runs joined by single hyphens, 3 to 40 characters.
ALTER TABLE "Game" ADD CONSTRAINT "Game_slug_check"
    CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 3 AND 40);

-- A folder inside a repository: "" is the top; otherwise no leading or trailing slash, no ".." step (it would
-- climb out of the repository), and at most 200 characters.
ALTER TABLE "Game" ADD CONSTRAINT "Game_repoFolder_check"
    CHECK (
        char_length("repoFolder") <= 200
        AND "repoFolder" !~ '^/'
        AND "repoFolder" !~ '/$'
        AND "repoFolder" !~ '(^|/)\.\.(/|$)'
    );

-- A live game has files to serve.
ALTER TABLE "Game" ADD CONSTRAINT "Game_live_check"
    CHECK ("state" <> 'live' OR "livePullId" IS NOT NULL);

-- A commit id as GitHub reports it: 40 lowercase hex characters.
ALTER TABLE "GamePull" ADD CONSTRAINT "GamePull_commitSha_check"
    CHECK ("commitSha" ~ '^[0-9a-f]{40}$');

-- A pull that passed the checks holds files, and files have size.
ALTER TABLE "GamePull" ADD CONSTRAINT "GamePull_counts_check"
    CHECK ("fileCount" > 0 AND "totalBytes" > 0);

-- A pull is a fact that is only ever added. The function is the one the membership migration made.
CREATE TRIGGER "GamePull_append_only" BEFORE UPDATE OR DELETE ON "GamePull"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('GamePull');
