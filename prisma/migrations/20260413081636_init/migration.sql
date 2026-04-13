/*
  Warnings:

  - You are about to drop the column `city` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `ward` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `addressId` on the `Order` table. All the data in the column will be lost.
  - Added the required column `title` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_addressId_fkey";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "city",
DROP COLUMN "district",
DROP COLUMN "street",
DROP COLUMN "ward",
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "addressId";

-- AlterTable
ALTER TABLE "OrderFood" ADD COLUMN     "fullText" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
