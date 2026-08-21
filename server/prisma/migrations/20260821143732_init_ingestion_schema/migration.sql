-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('PASSED', 'FAILED', 'ERRORED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "IngestionMode" AS ENUM ('JUNIT_XML', 'JOB_LEVEL');

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "workflowRunId" BIGINT NOT NULL,
    "jobId" BIGINT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" "TestRunStatus" NOT NULL,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "runnerOs" TEXT,
    "isRetry" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionCursor" (
    "repo" TEXT NOT NULL,
    "lastRunIdSeen" BIGINT,
    "lastSyncedAt" TIMESTAMP(3),
    "ingestionMode" "IngestionMode",

    CONSTRAINT "IngestionCursor_pkey" PRIMARY KEY ("repo")
);

-- CreateIndex
CREATE INDEX "Test_repo_idx" ON "Test"("repo");

-- CreateIndex
CREATE UNIQUE INDEX "Test_repo_suite_name_key" ON "Test"("repo", "suite", "name");

-- CreateIndex
CREATE INDEX "TestRun_testId_startedAt_idx" ON "TestRun"("testId", "startedAt");

-- CreateIndex
CREATE INDEX "TestRun_workflowRunId_idx" ON "TestRun"("workflowRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TestRun_testId_workflowRunId_jobId_key" ON "TestRun"("testId", "workflowRunId", "jobId");

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
