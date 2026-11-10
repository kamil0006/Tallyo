-- AlterTable
ALTER TABLE "ScheduledExpense" ADD COLUMN     "amountHistory" JSONB NOT NULL DEFAULT '[]';
