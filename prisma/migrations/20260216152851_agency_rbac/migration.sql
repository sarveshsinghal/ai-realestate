/*
  Warnings:

  - A unique constraint covering the columns `[agencyId,supabaseUserId]` on the table `AgencyMember` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `AgencyMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supabaseUserId` to the `AgencyMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AgencyMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Listing" DROP CONSTRAINT "Listing_agencyId_fkey";

-- AlterTable
ALTER TABLE "AgencyMember" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "supabaseUserId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "agencyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "agencyName" TEXT,
ALTER COLUMN "agencyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AgencyMember_supabaseUserId_idx" ON "AgencyMember"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyMember_agencyId_supabaseUserId_key" ON "AgencyMember"("agencyId", "supabaseUserId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
