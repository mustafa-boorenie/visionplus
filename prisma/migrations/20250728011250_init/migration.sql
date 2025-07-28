-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "startUrl" TEXT,
    "currentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sequenceId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "arguments" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "executionTime" INTEGER,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result" JSONB,

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandStep" (
    "id" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "action" JSONB NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "error" TEXT,

    CONSTRAINT "CommandStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "commandId" TEXT,
    "filename" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageUrl" TEXT,
    "pageTitle" TEXT,
    "description" TEXT,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "originalPrompt" TEXT NOT NULL,
    "scriptJson" JSONB NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceExecution" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "executionTime" INTEGER NOT NULL,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "SequenceExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionType" TEXT NOT NULL,
    "selector" TEXT,
    "pageUrl" TEXT,
    "elementFound" BOOLEAN,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "recoveryAttempt" JSONB,
    "suggestedSelector" TEXT,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "Command_sessionId_idx" ON "Command"("sessionId");

-- CreateIndex
CREATE INDEX "Command_executedAt_idx" ON "Command"("executedAt");

-- CreateIndex
CREATE INDEX "CommandStep_commandId_idx" ON "CommandStep"("commandId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandStep_commandId_stepNumber_key" ON "CommandStep"("commandId", "stepNumber");

-- CreateIndex
CREATE INDEX "Screenshot_sessionId_idx" ON "Screenshot"("sessionId");

-- CreateIndex
CREATE INDEX "Screenshot_commandId_idx" ON "Screenshot"("commandId");

-- CreateIndex
CREATE INDEX "Screenshot_capturedAt_idx" ON "Screenshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_name_key" ON "Sequence"("name");

-- CreateIndex
CREATE INDEX "Sequence_name_idx" ON "Sequence"("name");

-- CreateIndex
CREATE INDEX "Sequence_category_idx" ON "Sequence"("category");

-- CreateIndex
CREATE INDEX "Sequence_createdAt_idx" ON "Sequence"("createdAt");

-- CreateIndex
CREATE INDEX "SequenceExecution_sequenceId_idx" ON "SequenceExecution"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceExecution_executedAt_idx" ON "SequenceExecution"("executedAt");

-- CreateIndex
CREATE INDEX "Feedback_actionType_idx" ON "Feedback"("actionType");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandStep" ADD CONSTRAINT "CommandStep_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "Command"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "Command"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceExecution" ADD CONSTRAINT "SequenceExecution_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
