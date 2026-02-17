-- listing_infra_v1 (manual migration)
-- This avoids Prisma shadow DB issues with pgvector.

-- 1) Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "ListingKind" AS ENUM ('SALE', 'RENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PropertyType" AS ENUM (
    'APARTMENT','HOUSE','STUDIO','DUPLEX','PENTHOUSE','TOWNHOUSE','ROOM',
    'OFFICE','RETAIL','WAREHOUSE','LAND','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "HeatingType" AS ENUM (
    'GAS','ELECTRIC','HEATPUMP','OIL','DISTRICT','WOOD','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Listing: add columns (safe defaults)
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" "ListingKind" NOT NULL DEFAULT 'SALE',
  ADD COLUMN IF NOT EXISTS "propertyType" "PropertyType" NOT NULL DEFAULT 'APARTMENT',
  ADD COLUMN IF NOT EXISTS "availableFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "yearBuilt" INTEGER,
  ADD COLUMN IF NOT EXISTS "floor" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalFloors" INTEGER,
  ADD COLUMN IF NOT EXISTS "furnished" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "petsAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hasElevator" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hasBalcony" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hasTerrace" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hasGarden" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hasCellar" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "parkingSpaces" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "heatingType" "HeatingType",
  ADD COLUMN IF NOT EXISTS "chargesMonthly" INTEGER,
  ADD COLUMN IF NOT EXISTS "feesAgency" INTEGER,
  ADD COLUMN IF NOT EXISTS "deposit" INTEGER,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- 3) Indexes on Listing (idempotent)
CREATE INDEX IF NOT EXISTS "Listing_bathrooms_idx" ON "Listing"("bathrooms");
CREATE INDEX IF NOT EXISTS "Listing_sizeSqm_idx" ON "Listing"("sizeSqm");
CREATE INDEX IF NOT EXISTS "Listing_kind_idx" ON "Listing"("kind");
CREATE INDEX IF NOT EXISTS "Listing_propertyType_idx" ON "Listing"("propertyType");
CREATE INDEX IF NOT EXISTS "Listing_isPublished_idx" ON "Listing"("isPublished");

-- 4) ListingSearchIndex: add new denormalized columns (idempotent)
ALTER TABLE "ListingSearchIndex"
  ADD COLUMN IF NOT EXISTS "bathrooms" INTEGER,
  ADD COLUMN IF NOT EXISTS "sizeSqm" INTEGER,
  ADD COLUMN IF NOT EXISTS "kind" TEXT,
  ADD COLUMN IF NOT EXISTS "propertyType" TEXT,
  ADD COLUMN IF NOT EXISTS "commune" TEXT;

-- 5) Indexes on ListingSearchIndex (idempotent)
CREATE INDEX IF NOT EXISTS "ListingSearchIndex_bathrooms_idx" ON "ListingSearchIndex"("bathrooms");
CREATE INDEX IF NOT EXISTS "ListingSearchIndex_sizeSqm_idx" ON "ListingSearchIndex"("sizeSqm");
CREATE INDEX IF NOT EXISTS "ListingSearchIndex_commune_idx" ON "ListingSearchIndex"("commune");
