-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "dockerApiUrl" TEXT,
ADD COLUMN     "dockerContainerId" TEXT,
ADD COLUMN     "dockerPort" TEXT;

-- CreateIndex
CREATE INDEX "Session_dockerContainerId_idx" ON "Session"("dockerContainerId");
