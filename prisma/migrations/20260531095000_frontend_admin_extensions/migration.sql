-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'ORDER', 'PAYMENT', 'PROMOTION', 'CHAT');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "image" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Food"
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "note" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Restaurant"
ADD COLUMN "coverImage" TEXT NOT NULL DEFAULT '',
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "minimumOrder" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "estimatedDeliveryTime" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Voucher"
ADD COLUMN "code" TEXT NOT NULL DEFAULT '',
ADD COLUMN "image" TEXT NOT NULL DEFAULT '',
ADD COLUMN "restaurantId" INTEGER,
ADD COLUMN "minimumOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "maximumDiscountAmount" DECIMAL(65,30),
ADD COLUMN "startAt" TIMESTAMP(3),
ADD COLUMN "endAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Voucher_code_idx" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_restaurantId_idx" ON "Voucher"("restaurantId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
