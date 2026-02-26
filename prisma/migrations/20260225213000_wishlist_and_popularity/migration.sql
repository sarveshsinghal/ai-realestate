-- Wishlist + Popularity + View Events
-- Safe to run once via `prisma migrate deploy`

-- 1) Enum for ListingBadge (only if not already created)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingBadge') THEN
    CREATE TYPE "ListingBadge" AS ENUM ('NONE', 'TRENDING', 'MOST_SAVED', 'MOST_VIEWED');
  END IF;
END $$;

-- 2) WishlistItem
CREATE TABLE IF NOT EXISTS "WishlistItem" (
  "id"        text PRIMARY KEY,
  "userId"    text NOT NULL,
  "listingId" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- FK constraints (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WishlistItem_userId_fkey') THEN
    ALTER TABLE "WishlistItem"
      ADD CONSTRAINT "WishlistItem_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Listing')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WishlistItem_listingId_fkey') THEN
    ALTER TABLE "WishlistItem"
      ADD CONSTRAINT "WishlistItem_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Unique + indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WishlistItem_userId_listingId_key') THEN
    ALTER TABLE "WishlistItem"
      ADD CONSTRAINT "WishlistItem_userId_listingId_key" UNIQUE ("userId","listingId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WishlistItem_userId_createdAt_idx" ON "WishlistItem" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WishlistItem_listingId_createdAt_idx" ON "WishlistItem" ("listingId", "createdAt");

-- 3) ListingViewEvent
CREATE TABLE IF NOT EXISTS "ListingViewEvent" (
  "id"        text PRIMARY KEY,
  "listingId" text NOT NULL,
  "userId"    text,
  "sessionId" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Listing')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ListingViewEvent_listingId_fkey') THEN
    ALTER TABLE "ListingViewEvent"
      ADD CONSTRAINT "ListingViewEvent_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ListingViewEvent_userId_fkey') THEN
    ALTER TABLE "ListingViewEvent"
      ADD CONSTRAINT "ListingViewEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ListingViewEvent_listingId_createdAt_idx" ON "ListingViewEvent" ("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListingViewEvent_userId_createdAt_idx" ON "ListingViewEvent" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListingViewEvent_sessionId_createdAt_idx" ON "ListingViewEvent" ("sessionId", "createdAt");

-- 4) ListingPopularity
CREATE TABLE IF NOT EXISTS "ListingPopularity" (
  "id"         text PRIMARY KEY,
  "listingId"  text NOT NULL UNIQUE,
  "score7d"    double precision NOT NULL DEFAULT 0,
  "views7d"    integer NOT NULL DEFAULT 0,
  "saves7d"    integer NOT NULL DEFAULT 0,
  "leads7d"    integer NOT NULL DEFAULT 0,
  "badge"      "ListingBadge" NOT NULL DEFAULT 'NONE',
  "segmentKey" text NOT NULL DEFAULT '',
  "createdAt"  timestamp NOT NULL DEFAULT now(),
  "updatedAt"  timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Listing')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ListingPopularity_listingId_fkey') THEN
    ALTER TABLE "ListingPopularity"
      ADD CONSTRAINT "ListingPopularity_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ListingPopularity_badge_score7d_idx" ON "ListingPopularity" ("badge", "score7d");
CREATE INDEX IF NOT EXISTS "ListingPopularity_segmentKey_score7d_idx" ON "ListingPopularity" ("segmentKey", "score7d");