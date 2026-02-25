generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum ListingCondition {
  NEW
  RENOVATED
  GOOD
  TO_RENOVATE
}

enum EnergyClass {
  A
  B
  C
  D
  E
  F
}

enum MemberRole {
  ADMIN
  MANAGER
  AGENT
  VIEWER
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  VIEWING
  OFFER
  WON
  LOST
}

enum ListingKind {
  SALE
  RENT
}

enum PropertyType {
  APARTMENT
  HOUSE
  STUDIO
  DUPLEX
  PENTHOUSE
  TOWNHOUSE
  ROOM
  OFFICE
  RETAIL
  WAREHOUSE
  LAND
  OTHER
}

enum HeatingType {
  GAS
  ELECTRIC
  HEATPUMP
  OIL
  DISTRICT
  WOOD
  OTHER
}

enum MatchScope {
  AGENCY
  NETWORK
  PUBLIC
}

enum BuyerProfileSource {
  LEAD_MESSAGE
  MANUAL
  MIXED
}

model User {
  id             String @id @default(cuid())
  // Link this to Supabase auth.users.id (uuid)
  supabaseUserId String @unique

  email     String?
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships AgencyMember[]
}

model Agency {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members       AgencyMember[]
  listings      Listing[]
  leads         Lead[]
  buyerProfiles BuyerProfile[]
  leadMatches   LeadMatch[]
}

model AgencyMember {
  id       String @id @default(cuid())
  agencyId String
  userId   String

  // Supabase auth user id (uuid) for scoping without joining User table
  supabaseUserId String
  email          String
  role           MemberRole @default(AGENT)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agency Agency @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([agencyId, userId])
  @@unique([agencyId, supabaseUserId])
  @@index([userId])
  @@index([agencyId])
  @@index([supabaseUserId])
}

model Listing {
  id String @id @default(cuid())

  // Public-facing fields
  title       String
  commune     String
  addressHint String?
  price       Int // EUR
  sizeSqm     Int
  bedrooms    Int
  bathrooms   Int
  condition   ListingCondition
  energyClass EnergyClass

  // ✅ NEW: content (critical)
  description String? @db.Text

  // ✅ NEW: sale vs rent + property type
  kind         ListingKind  @default(SALE)
  propertyType PropertyType @default(APARTMENT)

  // ✅ NEW: core “Lux consumer expectations”
  availableFrom DateTime?
  yearBuilt     Int?
  floor         Int?
  totalFloors   Int?
  furnished     Boolean?  @default(false)
  petsAllowed   Boolean?  @default(false)

  // ✅ NEW: amenities + parking
  hasElevator   Boolean? @default(false)
  hasBalcony    Boolean? @default(false)
  hasTerrace    Boolean? @default(false)
  hasGarden     Boolean? @default(false)
  hasCellar     Boolean? @default(false)
  parkingSpaces Int?     @default(0)

  // ✅ NEW: energy & heating (Lux users filter by this)
  heatingType    HeatingType?
  chargesMonthly Int? // rent listings (EUR)
  feesAgency     Int? // optional
  deposit        Int? // optional

  // ✅ NEW: optional geodata (future map search)
  latitude  Float?
  longitude Float?

  // Make nullable to allow seed/backfill before agency linkage
  agencyId String?
  agency   Agency? @relation(fields: [agencyId], references: [id], onDelete: SetNull)

  agencyName  String?
  searchIndex ListingSearchIndex?

  isPublished Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  media        ListingMedia[]
  priceHistory ListingPriceHistory[]
  leads        Lead[]
  matches      LeadMatch[]

  @@index([commune])
  @@index([price])
  @@index([bedrooms])
  @@index([bathrooms])
  @@index([sizeSqm])
  @@index([kind])
  @@index([propertyType])
  @@index([isPublished])
  @@index([agencyId])
}

model ListingMedia {
  id        String @id @default(cuid())
  listingId String
  url       String
  sortOrder Int    @default(0)

  listing Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@index([listingId])
}

model ListingPriceHistory {
  id         String   @id @default(cuid())
  listingId  String
  price      Int
  recordedAt DateTime @default(now())

  listing Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@index([listingId, recordedAt])
}

model Lead {
  id String @id @default(cuid())

  // Make nullable to allow older leads / transitional data
  agencyId  String?
  listingId String?

  name    String
  email   String
  phone   String?
  message String?

  status LeadStatus @default(NEW)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agency  Agency?  @relation(fields: [agencyId], references: [id], onDelete: SetNull)
  listing Listing? @relation(fields: [listingId], references: [id], onDelete: SetNull)

  buyerProfile BuyerProfile?
  matches      LeadMatch[]

  @@index([agencyId, createdAt])
  @@index([listingId])
  @@index([status])
}

model ListingSearchIndex {
  listingId  String                       @id
  agencyId   String
  status     String
  searchText String
  embedding  Unsupported("vector(1536)")?
  updatedAt  DateTime                     @updatedAt

  price        Int?
  bedrooms     Int?
  bathrooms    Int?
  sizeSqm      Int?
  kind         String? // "SALE"/"RENT"
  propertyType String?
  commune      String?

  listing Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@index([agencyId])
  @@index([status])
  @@index([price])
  @@index([bedrooms])
  @@index([bathrooms])
  @@index([sizeSqm])
  @@index([commune])
}

model BuyerProfile {
  id       String @id @default(cuid())
  agencyId String
  leadId   String @unique

  scope  MatchScope         @default(AGENCY)
  source BuyerProfileSource @default(LEAD_MESSAGE)

  // Structured preferences (fast filtering)
  kind         ListingKind?
  propertyType PropertyType?

  budgetMin    Int?
  budgetMax    Int?
  sizeMinSqm   Int?
  sizeMaxSqm   Int?
  bedroomsMin  Int?
  bedroomsMax  Int?
  bathroomsMin Int?
  communes     String[] // Postgres text[]

  // Amenities as requirements (hard filters)
  furnished   Boolean?
  petsAllowed Boolean?
  hasElevator Boolean?
  hasBalcony  Boolean?
  hasTerrace  Boolean?
  hasGarden   Boolean?
  hasCellar   Boolean?
  parkingMin  Int?

  // Free text snapshot used for embeddings/ranking (derived)
  queryText String? @db.Text

  // Optional: store buyer embedding for semantic matching later
  embedding Unsupported("vector(1536)")?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agency Agency @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  lead   Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)

  versions BuyerProfileVersion[]

  @@index([agencyId])
  @@index([scope])
}

model BuyerProfileVersion {
  id             String @id @default(cuid())
  buyerProfileId String

  // audit + reproducibility
  model         String?
  promptVersion String?
  sourceText    String? @db.Text
  extractedJson Json
  notes         String? @db.Text

  createdAt DateTime @default(now())

  buyerProfile BuyerProfile @relation(fields: [buyerProfileId], references: [id], onDelete: Cascade)

  @@index([buyerProfileId, createdAt])
}

model LeadMatch {
  id        String @id @default(cuid())
  agencyId  String
  leadId    String
  listingId String

  scope MatchScope @default(AGENCY)

  // scoring (store components for explainability)
  score           Float
  structuredScore Float
  semanticScore   Float
  freshnessScore  Float?

  // why it matched (UI-ready)
  reasons Json

  createdAt DateTime @default(now())

  agency  Agency  @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  lead    Lead    @relation(fields: [leadId], references: [id], onDelete: Cascade)
  listing Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([leadId, listingId])
  @@index([agencyId, createdAt])
  @@index([listingId])
  @@index([leadId])
  @@index([scope])
}
