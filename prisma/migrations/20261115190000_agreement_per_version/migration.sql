-- A maker agrees to each version of the maker agreement once. A new version is a new row, asked for again, and the
-- rows for the older versions stay as the record of what the maker agreed to then.

-- DropIndex
DROP INDEX "MakerAgreement_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "MakerAgreement_userId_version_key" ON "MakerAgreement"("userId", "version");
