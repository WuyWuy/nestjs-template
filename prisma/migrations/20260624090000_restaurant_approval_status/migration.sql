-- CreateEnum
CREATE TYPE "RestaurantApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Add the enum field and preserve existing approval decisions.
ALTER TABLE "Restaurant"
ADD COLUMN "status" "RestaurantApprovalStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "Restaurant"
SET "status" = CASE
    WHEN "approved" = true THEN 'APPROVED'::"RestaurantApprovalStatus"
    ELSE 'PENDING'::"RestaurantApprovalStatus"
END;

ALTER TABLE "Restaurant" DROP COLUMN "approved";

-- Enforce unique account phone and role registration.
-- Restaurant ownership is checked in the service so existing multi-restaurant
-- owners can be migrated without destructive data changes.
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");
