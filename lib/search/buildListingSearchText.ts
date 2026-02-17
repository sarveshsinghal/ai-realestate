// lib/search/buildListingSearchText.ts

export type ListingSearchSource = {
  id: string;
  title: string;
  commune: string;
  addressHint?: string | null;
  description?: string | null;

  kind?: string | null; // SALE / RENT
  propertyType?: string | null;

  price?: number | null;
  sizeSqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;

  condition?: string | null;
  energyClass?: string | null;
  agencyName?: string | null;

  // amenities
  furnished?: boolean;
  petsAllowed?: boolean;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  hasCellar?: boolean;
  parkingSpaces?: number | null;

  heatingType?: string | null;
  chargesMonthly?: number | null;
  deposit?: number | null;
  feesAgency?: number | null;

  yearBuilt?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  availableFrom?: Date | string | null;
};

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function boolLine(label: string, value?: boolean) {
  if (value === true) return `${label}: yes`;
  if (value === false) return `${label}: no`;
  return null;
}

export function buildListingSearchText(l: ListingSearchSource): string {
  const lines: string[] = [];

  // Core identity
  lines.push(`TITLE: ${normalizeWhitespace(l.title)}`);
  lines.push(`COMMUNE: ${l.commune}`);

  if (l.kind) lines.push(`LISTING_TYPE: ${l.kind}`);
  if (l.propertyType) lines.push(`PROPERTY_TYPE: ${l.propertyType}`);

  if (l.addressHint)
    lines.push(`AREA: ${normalizeWhitespace(l.addressHint)}`);

  if (l.description)
    lines.push(`DESCRIPTION: ${normalizeWhitespace(l.description)}`);

  // Specs
  if (l.price != null) lines.push(`PRICE_EUR: ${l.price}`);
  if (l.sizeSqm != null) lines.push(`SIZE_SQM: ${l.sizeSqm}`);
  if (l.bedrooms != null) lines.push(`BEDROOMS: ${l.bedrooms}`);
  if (l.bathrooms != null) lines.push(`BATHROOMS: ${l.bathrooms}`);
  if (l.yearBuilt != null) lines.push(`YEAR_BUILT: ${l.yearBuilt}`);
  if (l.floor != null) lines.push(`FLOOR: ${l.floor}`);
  if (l.totalFloors != null) lines.push(`TOTAL_FLOORS: ${l.totalFloors}`);

  if (l.condition) lines.push(`CONDITION: ${l.condition}`);
  if (l.energyClass) lines.push(`ENERGY_CLASS: ${l.energyClass}`);
  if (l.heatingType) lines.push(`HEATING_TYPE: ${l.heatingType}`);

  if (l.availableFrom)
    lines.push(`AVAILABLE_FROM: ${new Date(l.availableFrom).toISOString()}`);

  // Rent-specific
  if (l.chargesMonthly != null)
    lines.push(`MONTHLY_CHARGES_EUR: ${l.chargesMonthly}`);
  if (l.deposit != null) lines.push(`DEPOSIT_EUR: ${l.deposit}`);
  if (l.feesAgency != null) lines.push(`AGENCY_FEES_EUR: ${l.feesAgency}`);

  // Amenities
  const amenityLines = [
    boolLine("FURNISHED", l.furnished),
    boolLine("PETS_ALLOWED", l.petsAllowed),
    boolLine("ELEVATOR", l.hasElevator),
    boolLine("BALCONY", l.hasBalcony),
    boolLine("TERRACE", l.hasTerrace),
    boolLine("GARDEN", l.hasGarden),
    boolLine("CELLAR", l.hasCellar),
  ].filter(Boolean) as string[];

  amenityLines.forEach((line) => lines.push(line));

  if (l.parkingSpaces != null && l.parkingSpaces > 0) {
    lines.push(`PARKING_SPACES: ${l.parkingSpaces}`);
  }

  if (l.agencyName)
    lines.push(`AGENCY: ${normalizeWhitespace(l.agencyName)}`);

  // Luxembourg multilingual anchors (helps embeddings + FTS)
  lines.push(
    `SYNONYMS: balcony terrasse loggia patio`
  );
  lines.push(
    `SYNONYMS: cave cellar storage basement`
  );
  lines.push(
    `SYNONYMS: lift elevator ascenseur aufzug`
  );
  lines.push(
    `SYNONYMS: parking garage carport`
  );
  lines.push(
    `SYNONYMS: furnished meublé möbliert`
  );
  lines.push(
    `SYNONYMS: pet friendly animaux haustiere`
  );
  lines.push(
    `SYNONYMS: sale vente verkauf rent location miete`
  );

  return lines.join("\n");
}
