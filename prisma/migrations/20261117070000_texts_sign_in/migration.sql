-- Branch B of the texts plan: a person is found by their phone number, not their email address.
-- Undoing it is a second migration, not a revert: the phone columns can be dropped, and the rows thrown away below
-- are pauses of at most an hour.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paperEmail" TEXT,
ADD COLUMN     "phoneConfirmedAt" TIMESTAMPTZ,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false;

-- The pause is keyed by number now. The old rows were keyed by email address, which no screen takes any more, and a
-- pause lasts an hour at most, so they are thrown away and the column is renamed (the key and its check stay).
DELETE FROM "SignInGuard";
ALTER TABLE "SignInGuard" RENAME COLUMN "emailHash" TO "numberHash";
ALTER TABLE "SignInGuard" RENAME CONSTRAINT "SignInGuard_emailHash_check" TO "SignInGuard_numberHash_check";

-- CreateTable
CREATE TABLE "PendingSignUp" (
    "numberHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "adultOn" DATE NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingSignUp_pkey" PRIMARY KEY ("numberHash","browserHash")
);

-- CreateTable
CREATE TABLE "TextSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "providerId" TEXT,
    "sentAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TextSent_userId_kind_key_key" ON "TextSent"("userId", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- AddForeignKey
ALTER TABLE "TextSent" ADD CONSTRAINT "TextSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express CHECK constraints or triggers.
-- tests/features/accounts/schema.pg.test.ts covers both.

-- A number is always written one way (E.164), so one number is one account.
ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumber_check" CHECK ("phoneNumber" ~ '^\+[0-9]{8,15}$');

-- A text that went out is a fact that is only ever added: asking for the same notice again finds the row and sends
-- nothing. The function is the one the membership migration made.
CREATE TRIGGER "TextSent_append_only" BEFORE UPDATE OR DELETE ON "TextSent"
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_change('TextSent');
