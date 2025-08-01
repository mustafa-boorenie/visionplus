/*
  Warnings:

  - You are about to drop the column `executedAt` on the `Command` table. All the data in the column will be lost.
  - The `errors` column on the `Command` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `scriptJson` on the `Sequence` table. All the data in the column will be lost.
  - The `tags` column on the `Sequence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `errors` column on the `SequenceExecution` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `script` to the `Sequence` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Command_executedAt_idx";

-- AlterTable
ALTER TABLE "Command" DROP COLUMN "executedAt",
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ALTER COLUMN "success" DROP NOT NULL,
ALTER COLUMN "success" DROP DEFAULT,
DROP COLUMN "errors",
ADD COLUMN     "errors" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "scriptJson",
ADD COLUMN     "editedPrompt" TEXT,
ADD COLUMN     "script" JSONB NOT NULL,
DROP COLUMN "tags",
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SequenceExecution" DROP COLUMN "errors",
ADD COLUMN     "errors" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "Command_startedAt_idx" ON "Command"("startedAt");
