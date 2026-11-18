-- AlterTable
-- IF NOT EXISTS: several environments were created with `prisma db push`
-- before these migrations were checked in, so the columns may already exist.
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS     "classification" TEXT,
ADD COLUMN IF NOT EXISTS     "classificationLabel" TEXT,
ADD COLUMN IF NOT EXISTS     "zone" TEXT,
ADD COLUMN IF NOT EXISTS     "zonalHead" TEXT,
ADD COLUMN IF NOT EXISTS     "areaManager" TEXT,
ADD COLUMN IF NOT EXISTS     "branchManager" TEXT,
ADD COLUMN IF NOT EXISTS     "territory" TEXT,
ADD COLUMN IF NOT EXISTS     "territoryHead" TEXT,
ADD COLUMN IF NOT EXISTS     "reportingManager" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Branch_classification_idx" ON "Branch"("classification");
