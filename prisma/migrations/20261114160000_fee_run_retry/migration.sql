-- A fee report run that failed is asked for again over the same stretch of time, so the stretch's start cannot be
-- unique for all runs. What must hold is that no two runs that are not failed cover any of the same time, so the
-- stretches never overlap and none is read twice. A trigger says so: the table's other rules (its move from
-- requested to stored or failed, once) are triggers too.
DROP INDEX "StripeFeeRun_intervalStart_key";

CREATE FUNCTION reject_overlapping_fee_run() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "StripeFeeRun"
        WHERE "state" <> 'failed'
          AND "intervalStart" < NEW."intervalEnd"
          AND "intervalEnd" > NEW."intervalStart"
    ) THEN
        RAISE EXCEPTION 'a Stripe fee report is already asked for part of this stretch'
            USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "StripeFeeRun_no_overlap" BEFORE INSERT ON "StripeFeeRun"
    FOR EACH ROW EXECUTE FUNCTION reject_overlapping_fee_run();
