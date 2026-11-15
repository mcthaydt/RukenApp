-- CreateTable
CREATE TABLE "CopyStamp" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "copy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyStamp_pkey" PRIMARY KEY ("id")
);


-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/lib/server/copy.pg.test.ts covers them.

-- One row only: claimCopy adds it as id 1, so a second claim finds it and adds nothing.
ALTER TABLE "CopyStamp" ADD CONSTRAINT "CopyStamp_one_row" CHECK ("id" = 1);
ALTER TABLE "CopyStamp" ADD CONSTRAINT "CopyStamp_copy_check" CHECK ("copy" IN ('test', 'live'));

-- Which copy a database belongs to never changes. The function is the one the membership migration made.
CREATE TRIGGER "CopyStamp_append_only" BEFORE UPDATE OR DELETE ON "CopyStamp"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('CopyStamp');
