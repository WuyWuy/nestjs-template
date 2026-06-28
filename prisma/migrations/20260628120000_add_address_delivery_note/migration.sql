-- Per-user supplementary map/location detail (not shared across users)
ALTER TABLE "UserAddress" ADD COLUMN IF NOT EXISTS "addressDetail" VARCHAR(500);

-- Remove deprecated column if a previous draft migration added it to Address
ALTER TABLE "Address" DROP COLUMN IF EXISTS "deliveryNote";
