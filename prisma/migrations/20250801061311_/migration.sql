-- CreateTable
CREATE TABLE "ConsoleLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "commandId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsoleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsoleLog_sessionId_idx" ON "ConsoleLog"("sessionId");

-- CreateIndex
CREATE INDEX "ConsoleLog_commandId_idx" ON "ConsoleLog"("commandId");

-- CreateIndex
CREATE INDEX "ConsoleLog_level_idx" ON "ConsoleLog"("level");

-- CreateIndex
CREATE INDEX "ConsoleLog_createdAt_idx" ON "ConsoleLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ConsoleLog" ADD CONSTRAINT "ConsoleLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleLog" ADD CONSTRAINT "ConsoleLog_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "Command"("id") ON DELETE CASCADE ON UPDATE CASCADE;
