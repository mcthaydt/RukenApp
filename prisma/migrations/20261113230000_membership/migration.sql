-- CreateEnum
CREATE TYPE "PremiumPlan" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "PremiumState" AS ENUM ('active', 'past_due', 'canceling', 'ended');

-- CreateEnum
CREATE TYPE "CheckoutState" AS ENUM ('open', 'completed', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "plan" "PremiumPlan" NOT NULL,
    "state" "PremiumState" NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
    "cancelAt" TIMESTAMPTZ,
    "pastDueSince" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PremiumMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PremiumPlan" NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "state" "CheckoutState" NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMPTZ,
    "broughtByUserId" TEXT,
    "arrivalPath" TEXT,
    "arrivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookInbox" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ NOT NULL,
    "processedAt" TIMESTAMPTZ,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WebhookInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "plan" "PremiumPlan" NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "grossCents" BIGINT NOT NULL,
    "taxCents" BIGINT NOT NULL,
    "cardFeeCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipStart" (
    "id" TEXT NOT NULL,
    "checkoutIntentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "plan" "PremiumPlan" NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "broughtByUserId" TEXT,
    "arrivalPath" TEXT,
    "arrivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipStart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_userId_key" ON "BillingCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumMembership_userId_key" ON "PremiumMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumMembership_stripeSubscriptionId_key" ON "PremiumMembership"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_stripeCheckoutSessionId_key" ON "CheckoutIntent"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "CheckoutIntent_userId_idx" ON "CheckoutIntent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookInbox_deliveryId_key" ON "WebhookInbox"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPayment_stripeInvoiceId_key" ON "MembershipPayment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "MembershipPayment_userId_idx" ON "MembershipPayment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipStart_checkoutIntentId_key" ON "MembershipStart"("checkoutIntentId");

-- CreateIndex
CREATE INDEX "MembershipStart_userId_idx" ON "MembershipStart"("userId");

-- CreateIndex
CREATE INDEX "MembershipStart_broughtByUserId_idx" ON "MembershipStart"("broughtByUserId");

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumMembership" ADD CONSTRAINT "PremiumMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_broughtByUserId_fkey" FOREIGN KEY ("broughtByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipStart" ADD CONSTRAINT "MembershipStart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipStart" ADD CONSTRAINT "MembershipStart_broughtByUserId_fkey" FOREIGN KEY ("broughtByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/membership/schema.pg.test.ts covers every one.

-- A payment is money that moved, so it is more than nothing; tax and the card fee are never negative.
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_amounts_check"
    CHECK ("grossCents" > 0 AND "taxCents" >= 0 AND "cardFeeCents" >= 0);

-- An arrival is the maker, the link's path and the time together, or none of them. Half of one is a bug.
ALTER TABLE "MembershipStart" ADD CONSTRAINT "MembershipStart_arrival_check"
    CHECK (
        ("broughtByUserId" IS NULL AND "arrivalPath" IS NULL AND "arrivedAt" IS NULL)
        OR ("broughtByUserId" IS NOT NULL AND "arrivalPath" IS NOT NULL AND "arrivedAt" IS NOT NULL)
    );

-- Facts that are only ever added. The table name is passed as the trigger argument rather than read
-- from TG_TABLE_NAME, so the message names the table the same way wherever the trigger is attached.
CREATE FUNCTION reject_append_only_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_ARGV[0], TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "MembershipPayment_append_only" BEFORE UPDATE OR DELETE ON "MembershipPayment"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('MembershipPayment');
CREATE TRIGGER "MembershipStart_append_only" BEFORE UPDATE OR DELETE ON "MembershipStart"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('MembershipStart');
