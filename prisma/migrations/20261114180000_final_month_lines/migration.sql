-- A final month takes no new lines either ----------------------------------------------------------------------------

-- `JournalEntry_open_period` refuses a new entry into a final month, but a line can be added later under an entry that
-- is already there, and a pair of lines adding up to zero keeps that entry balanced. So a line is refused when the
-- entry it belongs to is in a final month. A closed month still takes lines: its pool is shared after it closes and
-- before it is final.
CREATE FUNCTION reject_line_into_final_period() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    entry_period text;
BEGIN
    SELECT e."period" INTO entry_period
        FROM "JournalEntry" e
        JOIN "LedgerPeriod" p ON p."period" = e."period"
        WHERE e."id" = NEW."entryId" AND p."state" = 'final';
    IF entry_period IS NOT NULL THEN
        RAISE EXCEPTION 'period % is final and takes no new lines', entry_period
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "JournalLine_open_period" BEFORE INSERT ON "JournalLine"
    FOR EACH ROW EXECUTE FUNCTION reject_line_into_final_period();
