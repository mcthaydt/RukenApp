-- CreateEnum
CREATE TYPE "LedgerPeriodState" AS ENUM ('open', 'closed', 'final');

-- CreateEnum
CREATE TYPE "JournalEntryKind" AS ENUM ('payment', 'payment_fee', 'release', 'refund', 'chargeback', 'pool_share', 'pool_carry', 'transfer', 'payout_cost', 'correction');

-- CreateTable
CREATE TABLE "LedgerPeriod" (
    "period" TEXT NOT NULL,
    "state" "LedgerPeriodState" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMPTZ,
    "finalAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerPeriod_pkey" PRIMARY KEY ("period")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" "JournalEntryKind" NOT NULL,
    "stripeInvoiceId" TEXT,
    "gameId" TEXT,
    "reversesId" TEXT,
    "linesHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "makerUserId" TEXT,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_idempotencyKey_key" ON "JournalEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JournalEntry_period_idx" ON "JournalEntry"("period");

-- CreateIndex
CREATE INDEX "JournalEntry_stripeInvoiceId_idx" ON "JournalEntry"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_account_idx" ON "JournalLine"("account");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_period_fkey" FOREIGN KEY ("period") REFERENCES "LedgerPeriod"("period") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_makerUserId_fkey" FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/money/schema.pg.test.ts covers every one.

-- A month is written YYYY-MM.
ALTER TABLE "LedgerPeriod" ADD CONSTRAINT "LedgerPeriod_period_check"
    CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- A maker's account names its maker and is that maker's payable account, and no other account names a maker. The
-- second branch tests "makerUserId" IS NOT NULL first: without it, a maker line with no maker would make the
-- comparison NULL rather than false, and Postgres lets a NULL CHECK pass.
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_maker_check" CHECK (
    ("makerUserId" IS NULL AND "account" NOT LIKE 'maker:%')
    OR ("makerUserId" IS NOT NULL AND "account" = 'maker:' || "makerUserId" || ':payable'));

-- Facts that are only ever added. The function is the one the membership migration made.
CREATE TRIGGER "JournalEntry_append_only" BEFORE UPDATE OR DELETE ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('JournalEntry');
CREATE TRIGGER "JournalLine_append_only" BEFORE UPDATE OR DELETE ON "JournalLine"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('JournalLine');

-- Every journal entry adds up to zero -------------------------------------------------------------------------------

-- Double entry: the lines of an entry add up to exactly zero, and an entry has at least two lines. An entry and its
-- lines are inserted one row at a time, so no single row can be checked on its own; these are constraint triggers
-- deferred to COMMIT, when the whole entry is there. A failing check aborts the COMMIT and rolls the whole
-- transaction back.
--
-- One function serves both tables: TG_ARGV[0] names the column of the inserted row that holds the entry id ("id" on
-- JournalEntry, "entryId" on JournalLine). The check runs once per inserted row, so an entry of four lines is summed
-- five times; entries are small, and this keeps it simple.
CREATE FUNCTION check_journal_entry_balances() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    entry_id text := to_jsonb(NEW) ->> TG_ARGV[0];
    line_count bigint;
    total numeric;
BEGIN
    SELECT count(*), coalesce(sum("amount"), 0) INTO line_count, total
        FROM "JournalLine" WHERE "entryId" = entry_id;
    IF line_count < 2 OR total <> 0 THEN
        RAISE EXCEPTION 'journal entry % does not balance: % lines summing to %', entry_id, line_count, total
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "JournalEntry_balances" AFTER INSERT ON "JournalEntry"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balances('id');
CREATE CONSTRAINT TRIGGER "JournalLine_balances" AFTER INSERT ON "JournalLine"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balances('entryId');

-- A final month takes no new entries ---------------------------------------------------------------------------------

-- A late fact is posted into the month that is open instead. A closed month still takes entries: its pool is shared
-- after it closes and before it is final.
CREATE FUNCTION reject_entry_into_final_period() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "LedgerPeriod" WHERE "period" = NEW."period" AND "state" = 'final') THEN
        RAISE EXCEPTION 'period % is final and takes no new entries', NEW."period"
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "JournalEntry_open_period" BEFORE INSERT ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION reject_entry_into_final_period();

-- A month only moves forward -----------------------------------------------------------------------------------------

-- A row's "state" moves only along an arrow, never back, and the row is never deleted. The arguments:
--   TG_ARGV[0] the table name, for the error message;
--   TG_ARGV[1] the allowed moves, space-separated, each written from>to;
--   TG_ARGV[2] the columns that may change together with a move (the move's time), space-separated.
-- Any other column never changes, and with no move nothing changes at all. A final state has no arrows out, so a
-- finished row is frozen. The columns are compared as jsonb so the function does not name them: `jsonb - text[]`
-- removes the columns that are allowed to differ.
CREATE FUNCTION guard_forward_only() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    table_name text := TG_ARGV[0];
    allowed_moves text[] := string_to_array(TG_ARGV[1], ' ');
    move_columns text[] := string_to_array(TG_ARGV[2], ' ') || ARRAY['state'];
    move text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION '% rows are never deleted', table_name USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW."state" IS DISTINCT FROM OLD."state" THEN
        move := OLD."state"::text || '>' || NEW."state"::text;
        IF NOT (move = ANY (allowed_moves)) THEN
            RAISE EXCEPTION '%: moving % is not allowed', table_name, replace(move, '>', ' → ')
                USING ERRCODE = 'restrict_violation';
        END IF;
        IF (to_jsonb(NEW) - move_columns) <> (to_jsonb(OLD) - move_columns) THEN
            RAISE EXCEPTION '%: a move may only change %', table_name, array_to_string(move_columns, ', ')
                USING ERRCODE = 'restrict_violation';
        END IF;
    ELSIF to_jsonb(NEW) <> to_jsonb(OLD) THEN
        RAISE EXCEPTION '%: a row changes only when its state moves', table_name
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "LedgerPeriod_forward_only" BEFORE UPDATE OR DELETE ON "LedgerPeriod"
    FOR EACH ROW EXECUTE FUNCTION guard_forward_only('LedgerPeriod', 'open>closed closed>final', 'closedAt finalAt');
