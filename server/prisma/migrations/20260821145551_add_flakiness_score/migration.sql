-- CreateEnum
CREATE TYPE "FlakinessStatus" AS ENUM ('STABLE', 'FLAGGED', 'QUARANTINED');

-- CreateTable
CREATE TABLE "FlakinessScore" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "flipRate" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "status" "FlakinessStatus" NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlakinessScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlakinessScore_testId_computedAt_idx" ON "FlakinessScore"("testId", "computedAt");

-- AddForeignKey
ALTER TABLE "FlakinessScore" ADD CONSTRAINT "FlakinessScore_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
