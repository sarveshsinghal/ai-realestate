-- CreateTable
CREATE TABLE "ListingSearchIndex" (
    "listingId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "embedding" vector,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "price" INTEGER,
    "bedrooms" INTEGER,
    "propertyType" TEXT,
    "commune" TEXT,

    CONSTRAINT "ListingSearchIndex_pkey" PRIMARY KEY ("listingId")
);

-- CreateIndex
CREATE INDEX "ListingSearchIndex_agencyId_idx" ON "ListingSearchIndex"("agencyId");

-- CreateIndex
CREATE INDEX "ListingSearchIndex_status_idx" ON "ListingSearchIndex"("status");

-- CreateIndex
CREATE INDEX "ListingSearchIndex_price_idx" ON "ListingSearchIndex"("price");

-- CreateIndex
CREATE INDEX "ListingSearchIndex_bedrooms_idx" ON "ListingSearchIndex"("bedrooms");

-- CreateIndex
CREATE INDEX "ListingSearchIndex_commune_idx" ON "ListingSearchIndex"("commune");

-- AddForeignKey
ALTER TABLE "ListingSearchIndex" ADD CONSTRAINT "ListingSearchIndex_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
