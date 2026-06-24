-- CreateEnum
CREATE TYPE "ConfirmedBy" AS ENUM ('CUSTOMER', 'SYSTEM', 'ADMIN');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBy" "ConfirmedBy",
ADD COLUMN     "autoConfirmAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_autoConfirmAt_idx" ON "Order"("status", "autoConfirmAt");
