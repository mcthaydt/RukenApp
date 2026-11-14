-- CreateEnum
CREATE TYPE "FeeRunState" AS ENUM ('requested', 'stored', 'failed');

-- CreateEnum
CREATE TYPE "FeeKind" AS ENUM ('payment', 'payout', 'counted', 'credit', 'returned');

-- CreateEnum
CREATE TYPE "ReversalKind" AS ENUM ('refund', 'chargeback_opened', 'chargeback_won', 'chargeback_lost');

-- CreateTable
CREATE TABLE "PaymentPosting" (
    "stripeInvoiceId" TEXT NOT NULL,
    "firstPeriod" TEXT NOT NULL,
    "stripeChargeId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "balanceTransactionId" TEXT NOT NULL,
    "postedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPosting_pkey" PRIMARY KEY ("stripeInvoiceId")
);

-- CreateTable
CREATE TABLE "StripeFeeRun" (
    "id" TEXT NOT NULL,
    "intervalStart" TIMESTAMPTZ NOT NULL,
    "intervalEnd" TIMESTAMPTZ NOT NULL,
    "stripeReportRunId" TEXT NOT NULL,
    "state" "FeeRunState" NOT NULL DEFAULT 'requested',
    "rowCount" INTEGER,
    "problem" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL,
    "storedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeFeeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeFeeRow" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "balanceTransactionId" TEXT NOT NULL,
    "balanceTransactionAt" TEXT NOT NULL,
    "feeTransactionId" TEXT NOT NULL,
    "incurredBy" TEXT NOT NULL,
    "incurredByType" TEXT NOT NULL,
    "incurredAt" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountText" TEXT NOT NULL,
    "taxText" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "settledVia" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeFeeRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePosting" (
    "feeRowId" TEXT NOT NULL,
    "kind" "FeeKind" NOT NULL,
    "stripeInvoiceId" TEXT,
    "makerUserId" TEXT,
    "microCents" BIGINT NOT NULL,
    "postedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePosting_pkey" PRIMARY KEY ("feeRowId")
);

-- CreateTable
CREATE TABLE "StripeReversal" (
    "id" TEXT NOT NULL,
    "kind" "ReversalKind" NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "feeCents" BIGINT NOT NULL,
    "returnedCents" BIGINT NOT NULL,
    "balanceTransactionIds" TEXT[],
    "at" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayDayRun" (
    "day" DATE NOT NULL,
    "rolledAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PlayDayRun_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "PlayDay" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPosting_stripeChargeId_key" ON "PaymentPosting"("stripeChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPosting_stripePaymentIntentId_key" ON "PaymentPosting"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPosting_balanceTransactionId_key" ON "PaymentPosting"("balanceTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeFeeRun_intervalStart_key" ON "StripeFeeRun"("intervalStart");

-- CreateIndex
CREATE UNIQUE INDEX "StripeFeeRun_stripeReportRunId_key" ON "StripeFeeRun"("stripeReportRunId");

-- CreateIndex
CREATE INDEX "StripeFeeRow_incurredBy_idx" ON "StripeFeeRow"("incurredBy");

-- CreateIndex
CREATE UNIQUE INDEX "StripeFeeRow_runId_rowNumber_key" ON "StripeFeeRow"("runId", "rowNumber");

-- CreateIndex
CREATE INDEX "PlayDay_day_idx" ON "PlayDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PlayDay_day_userId_gameId_key" ON "PlayDay"("day", "userId", "gameId");

-- AddForeignKey
ALTER TABLE "PaymentPosting" ADD CONSTRAINT "PaymentPosting_stripeInvoiceId_fkey" FOREIGN KEY ("stripeInvoiceId") REFERENCES "MembershipPayment"("stripeInvoiceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeFeeRow" ADD CONSTRAINT "StripeFeeRow_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StripeFeeRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePosting" ADD CONSTRAINT "FeePosting_feeRowId_fkey" FOREIGN KEY ("feeRowId") REFERENCES "StripeFeeRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePosting" ADD CONSTRAINT "FeePosting_makerUserId_fkey" FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayDay" ADD CONSTRAINT "PlayDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayDay" ADD CONSTRAINT "PlayDay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/money/schema.pg.test.ts covers every one.

-- A day's play is at least a second and at most three hours, the cap on one person's time on one game in a day.
ALTER TABLE "PlayDay" ADD CONSTRAINT "PlayDay_seconds_check"
    CHECK ("seconds" BETWEEN 1 AND 10800);

-- What kind of fee a posting is decides what it names: a payment's fee its invoice, a payout's fee its maker, and the
-- others neither.
ALTER TABLE "FeePosting" ADD CONSTRAINT "FeePosting_kind_check" CHECK (
    ("kind" = 'payment' AND "stripeInvoiceId" IS NOT NULL AND "makerUserId" IS NULL)
    OR ("kind" = 'payout' AND "makerUserId" IS NOT NULL AND "stripeInvoiceId" IS NULL)
    OR ("kind" IN ('counted', 'credit', 'returned') AND "stripeInvoiceId" IS NULL AND "makerUserId" IS NULL));

-- A reversal holds no amount below zero.
ALTER TABLE "StripeReversal" ADD CONSTRAINT "StripeReversal_amounts_check"
    CHECK ("amountCents" >= 0 AND "feeCents" >= 0 AND "returnedCents" >= 0);

-- A stretch of time ends after it starts.
ALTER TABLE "StripeFeeRun" ADD CONSTRAINT "StripeFeeRun_interval_check"
    CHECK ("intervalEnd" > "intervalStart");

-- Facts that are only ever added. The function is the one the membership migration made.
CREATE TRIGGER "PaymentPosting_append_only" BEFORE UPDATE OR DELETE ON "PaymentPosting"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PaymentPosting');
CREATE TRIGGER "StripeFeeRow_append_only" BEFORE UPDATE OR DELETE ON "StripeFeeRow"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('StripeFeeRow');
CREATE TRIGGER "FeePosting_append_only" BEFORE UPDATE OR DELETE ON "FeePosting"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('FeePosting');
CREATE TRIGGER "StripeReversal_append_only" BEFORE UPDATE OR DELETE ON "StripeReversal"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('StripeReversal');
CREATE TRIGGER "PlayDayRun_append_only" BEFORE UPDATE OR DELETE ON "PlayDayRun"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PlayDayRun');
CREATE TRIGGER "PlayDay_append_only" BEFORE UPDATE OR DELETE ON "PlayDay"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('PlayDay');

-- A fee run moves once, from requested to stored or to failed, and is never deleted. The function is the one the
-- ledger migration made.
CREATE TRIGGER "StripeFeeRun_forward_only" BEFORE UPDATE OR DELETE ON "StripeFeeRun"
    FOR EACH ROW EXECUTE FUNCTION guard_forward_only(
        'StripeFeeRun', 'requested>stored requested>failed', 'rowCount problem storedAt');
