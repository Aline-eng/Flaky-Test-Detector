-- CreateTable
CREATE TABLE "QuarantineEvent" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "transitionedTo" "FlakinessStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuarantineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuarantineEvent_testId_occurredAt_idx" ON "QuarantineEvent"("testId", "occurredAt");

-- AddForeignKey
ALTER TABLE "QuarantineEvent" ADD CONSTRAINT "QuarantineEvent_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
