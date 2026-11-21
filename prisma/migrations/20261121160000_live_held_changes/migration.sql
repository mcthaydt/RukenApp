-- A live game's new videos and new age rating, kept apart from what players see until staff say yes.

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "heldAgeRating" "AgeRating",
ADD COLUMN     "heldContentMarks" "ContentMark"[] DEFAULT ARRAY[]::"ContentMark"[];

-- CreateTable
CREATE TABLE "GameHeldClip" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "shape" "ClipShape" NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GameHeldClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameHeldClip_key_key" ON "GameHeldClip"("key");

-- CreateIndex
CREATE UNIQUE INDEX "GameHeldClip_gameId_shape_key" ON "GameHeldClip"("gameId", "shape");

-- AddForeignKey
ALTER TABLE "GameHeldClip" ADD CONSTRAINT "GameHeldClip_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express CHECK constraints.
-- tests/features/games/schema.pg.test.ts covers each.

-- A rating and its marks are held as a pair, and only for a live game. A held 18+ always has marks (so the yes can copy
-- the pair as it is), marks are held only with a held 18+, and "None of these" stands alone, as it does in
-- "Game_marks_check". The rating being held may equal the live one: changing only the marks of a live 18+ game holds
-- 18+ with the new marks. `IS DISTINCT FROM` is used where the rating may be null, since a bare comparison with null
-- is unknown and a CHECK lets unknown pass.
ALTER TABLE "Game" ADD CONSTRAINT "Game_held_check"
    CHECK (
        ("state" = 'live' OR ("heldAgeRating" IS NULL AND cardinality("heldContentMarks") = 0))
        AND (cardinality("heldContentMarks") = 0 OR "heldAgeRating" IS NOT DISTINCT FROM 'age_18')
        AND ("heldAgeRating" IS DISTINCT FROM 'age_18' OR cardinality("heldContentMarks") > 0)
        AND (NOT ('none' = ANY("heldContentMarks")) OR cardinality("heldContentMarks") = 1)
    );

-- A held video's key is the shape every clip's key has, so the media gate serves it and it cannot be guessed.
-- "GameClip" has no such check and gets none here.
ALTER TABLE "GameHeldClip" ADD CONSTRAINT "GameHeldClip_key_check"
    CHECK ("key" ~ '^clips/[a-z2-7]{10}/(upright|wide)-[0-9a-f]{16}\.(mp4|webm|mov)$');
