// app/agency/listings/_components/ListingEditor.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MediaGalleryManager from "./MediaGalleryManager";

type ListingKind = "SALE" | "RENT";
type PropertyType =
  | "APARTMENT"
  | "HOUSE"
  | "STUDIO"
  | "DUPLEX"
  | "PENTHOUSE"
  | "TOWNHOUSE"
  | "ROOM"
  | "OFFICE"
  | "RETAIL"
  | "WAREHOUSE"
  | "LAND"
  | "OTHER";

type ListingCondition = "NEW" | "RENOVATED" | "GOOD" | "TO_RENOVATE";
type EnergyClass = "A" | "B" | "C" | "D" | "E" | "F";
type HeatingType = "GAS" | "ELECTRIC" | "HEATPUMP" | "OIL" | "DISTRICT" | "WOOD" | "OTHER";

type ListingEditorProps = {
  listing: {
    id: string;

    title: string;
    description: string | null;

    kind: ListingKind;
    propertyType: PropertyType;

    commune: string;
    addressHint: string | null;

    price: number | null;
    sizeSqm: number;
    bedrooms: number;
    bathrooms: number;

    condition: ListingCondition;
    energyClass: EnergyClass;

    availableFrom: string | null; // ISO string from server (or null)
    yearBuilt: number | null;
    floor: number | null;
    totalFloors: number | null;

    furnished: boolean | null;
    petsAllowed: boolean | null;

    hasElevator: boolean | null;
    hasBalcony: boolean | null;
    hasTerrace: boolean | null;
    hasGarden: boolean | null;
    hasCellar: boolean | null;
    parkingSpaces: number | null;

    heatingType: HeatingType | null;
    chargesMonthly: number | null;
    feesAgency: number | null;
    deposit: number | null;

    isPublished: boolean;
  };

  initialMedia: { url: string; sortOrder: number }[];
  priceHistory: { price: number; createdAt: string }[];
};

function asNumberOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function asPositiveIntOrNull(s: string): number | null {
  const n = asNumberOrNull(s);
  if (n === null) return null;
  return Math.max(0, n);
}

export default function ListingEditor(props: ListingEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Basics
  const [title, setTitle] = useState(props.listing.title);
  const [description, setDescription] = useState(props.listing.description ?? "");
  const [commune, setCommune] = useState(props.listing.commune);
  const [addressHint, setAddressHint] = useState(props.listing.addressHint ?? "");

  const [kind, setKind] = useState<ListingKind>(props.listing.kind);
  const [propertyType, setPropertyType] = useState<PropertyType>(props.listing.propertyType);

  // Numbers as text for controlled inputs
  const [priceText, setPriceText] = useState(props.listing.price == null ? "" : String(props.listing.price));
  const [sizeSqmText, setSizeSqmText] = useState(String(props.listing.sizeSqm ?? 0));
  const [bedroomsText, setBedroomsText] = useState(String(props.listing.bedrooms ?? 0));
  const [bathroomsText, setBathroomsText] = useState(String(props.listing.bathrooms ?? 0));
  const [parkingSpacesText, setParkingSpacesText] = useState(
    props.listing.parkingSpaces == null ? "" : String(props.listing.parkingSpaces)
  );

  const [yearBuiltText, setYearBuiltText] = useState(props.listing.yearBuilt == null ? "" : String(props.listing.yearBuilt));
  const [floorText, setFloorText] = useState(props.listing.floor == null ? "" : String(props.listing.floor));
  const [totalFloorsText, setTotalFloorsText] = useState(
    props.listing.totalFloors == null ? "" : String(props.listing.totalFloors)
  );

  const [condition, setCondition] = useState<ListingCondition>(props.listing.condition);
  const [energyClass, setEnergyClass] = useState<EnergyClass>(props.listing.energyClass);
  const [heatingType, setHeatingType] = useState<HeatingType | "">(props.listing.heatingType ?? "");

  // Rent fields
  const [chargesMonthlyText, setChargesMonthlyText] = useState(
    props.listing.chargesMonthly == null ? "" : String(props.listing.chargesMonthly)
  );
  const [depositText, setDepositText] = useState(props.listing.deposit == null ? "" : String(props.listing.deposit));
  const [feesAgencyText, setFeesAgencyText] = useState(props.listing.feesAgency == null ? "" : String(props.listing.feesAgency));

  // Dates
  // Store as YYYY-MM-DD (HTML date input)
  const [availableFrom, setAvailableFrom] = useState<string>(() => {
    if (!props.listing.availableFrom) return "";
    const d = new Date(props.listing.availableFrom);
    if (Number.isNaN(d.getTime())) return "";
    // to yyyy-mm-dd in local timezone
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // Amenities toggles
  const [furnished, setFurnished] = useState(Boolean(props.listing.furnished));
  const [petsAllowed, setPetsAllowed] = useState(Boolean(props.listing.petsAllowed));
  const [hasElevator, setHasElevator] = useState(Boolean(props.listing.hasElevator));
  const [hasBalcony, setHasBalcony] = useState(Boolean(props.listing.hasBalcony));
  const [hasTerrace, setHasTerrace] = useState(Boolean(props.listing.hasTerrace));
  const [hasGarden, setHasGarden] = useState(Boolean(props.listing.hasGarden));
  const [hasCellar, setHasCellar] = useState(Boolean(props.listing.hasCellar));

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const parsed = useMemo(() => {
    const price = asPositiveIntOrNull(priceText);
    const sizeSqm = asPositiveIntOrNull(sizeSqmText);
    const bedrooms = asPositiveIntOrNull(bedroomsText);
    const bathrooms = asPositiveIntOrNull(bathroomsText);
    const parkingSpaces = asPositiveIntOrNull(parkingSpacesText);

    const yearBuilt = asPositiveIntOrNull(yearBuiltText);
    const floor = asNumberOrNull(floorText);
    const totalFloors = asPositiveIntOrNull(totalFloorsText);

    const chargesMonthly = asPositiveIntOrNull(chargesMonthlyText);
    const deposit = asPositiveIntOrNull(depositText);
    const feesAgency = asPositiveIntOrNull(feesAgencyText);

    const availableFromIso =
      availableFrom.trim() ? new Date(`${availableFrom}T00:00:00`).toISOString() : null;

    return {
      price,
      sizeSqm,
      bedrooms,
      bathrooms,
      parkingSpaces,
      yearBuilt,
      floor,
      totalFloors,
      chargesMonthly,
      deposit,
      feesAgency,
      availableFromIso,
    };
  }, [
    priceText,
    sizeSqmText,
    bedroomsText,
    bathroomsText,
    parkingSpacesText,
    yearBuiltText,
    floorText,
    totalFloorsText,
    chargesMonthlyText,
    depositText,
    feesAgencyText,
    availableFrom,
  ]);

  async function saveAll() {
    setError(null);
    setSavedAt(null);

    // minimal validation client-side
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!commune.trim()) {
      setError("Commune is required.");
      return;
    }
    if (parsed.sizeSqm == null || parsed.sizeSqm <= 0) {
      setError("Size (sqm) must be a positive number.");
      return;
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      commune: commune.trim(),
      addressHint: addressHint.trim() ? addressHint.trim() : null,

      kind,
      propertyType,

      // keep price optional so empty is allowed
      price: parsed.price,

      sizeSqm: parsed.sizeSqm,
      bedrooms: parsed.bedrooms ?? 0,
      bathrooms: parsed.bathrooms ?? 0,

      condition,
      energyClass,

      availableFrom: parsed.availableFromIso,
      yearBuilt: parsed.yearBuilt,
      floor: parsed.floor,
      totalFloors: parsed.totalFloors,

      furnished,
      petsAllowed,
      hasElevator,
      hasBalcony,
      hasTerrace,
      hasGarden,
      hasCellar,
      parkingSpaces: parsed.parkingSpaces,

      heatingType: heatingType === "" ? null : heatingType,

      // rent fields only meaningful for RENT, but ok to send nulls
      chargesMonthly: kind === "RENT" ? parsed.chargesMonthly : null,
      deposit: kind === "RENT" ? parsed.deposit : null,
      feesAgency: kind === "RENT" ? parsed.feesAgency : null,
    };

    const res = await fetch(`/api/agency/listings/${props.listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? "Failed to save");
      return;
    }

    setSavedAt(new Date().toLocaleString());
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Details</h2>
          <button
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
            onClick={() => void saveAll()}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              placeholder="Describe the property, neighborhood, highlights, etc."
            />
          </div>

          {/* Type selectors */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Listing type</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={kind}
                onChange={(e) => setKind(e.target.value as ListingKind)}
                disabled={isPending}
              >
                <option value="SALE">Sale</option>
                <option value="RENT">Rent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Property type</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                disabled={isPending}
              >
                {[
                  "APARTMENT",
                  "HOUSE",
                  "STUDIO",
                  "DUPLEX",
                  "PENTHOUSE",
                  "TOWNHOUSE",
                  "ROOM",
                  "OFFICE",
                  "RETAIL",
                  "WAREHOUSE",
                  "LAND",
                  "OTHER",
                ].map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Commune</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                disabled={isPending}
                placeholder="e.g. Luxembourg, Strassen, Hesperange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Address hint</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={addressHint}
                onChange={(e) => setAddressHint(e.target.value)}
                disabled={isPending}
                placeholder="e.g. Kirchberg / near European School"
              />
            </div>
          </div>

          {/* Core numbers */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium">Price (EUR)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 750000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Size (sqm)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={sizeSqmText}
                onChange={(e) => setSizeSqmText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 85"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Bedrooms</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={bedroomsText}
                onChange={(e) => setBedroomsText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Bathrooms</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={bathroomsText}
                onChange={(e) => setBathroomsText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 1"
              />
            </div>
          </div>

          {/* Condition / energy / heating */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Condition</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ListingCondition)}
                disabled={isPending}
              >
                {["NEW", "RENOVATED", "GOOD", "TO_RENOVATE"].map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Energy class</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={energyClass}
                onChange={(e) => setEnergyClass(e.target.value as EnergyClass)}
                disabled={isPending}
              >
                {["A", "B", "C", "D", "E", "F"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Heating type</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={heatingType}
                onChange={(e) => setHeatingType(e.target.value as HeatingType | "")}
                disabled={isPending}
              >
                <option value="">(not specified)</option>
                {["GAS", "ELECTRIC", "HEATPUMP", "OIL", "DISTRICT", "WOOD", "OTHER"].map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Building */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium">Year built</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={yearBuiltText}
                onChange={(e) => setYearBuiltText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 2012"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Floor</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={floorText}
                onChange={(e) => setFloorText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Total floors</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                inputMode="numeric"
                value={totalFloorsText}
                onChange={(e) => setTotalFloorsText(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Available from</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Amenities */}
          <div className="rounded-md border p-4">
            <div className="mb-3 text-sm font-medium">Amenities</div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} />
                Furnished
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={petsAllowed} onChange={(e) => setPetsAllowed(e.target.checked)} />
                Pets allowed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasElevator} onChange={(e) => setHasElevator(e.target.checked)} />
                Elevator
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasBalcony} onChange={(e) => setHasBalcony(e.target.checked)} />
                Balcony
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasTerrace} onChange={(e) => setHasTerrace(e.target.checked)} />
                Terrace
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasGarden} onChange={(e) => setHasGarden(e.target.checked)} />
                Garden
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasCellar} onChange={(e) => setHasCellar(e.target.checked)} />
                Cellar
              </label>

              <div>
                <label className="block text-sm font-medium">Parking spaces</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  inputMode="numeric"
                  value={parkingSpacesText}
                  onChange={(e) => setParkingSpacesText(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. 1"
                />
              </div>
            </div>
          </div>

          {/* Rent-only */}
          {kind === "RENT" ? (
            <div className="rounded-md border p-4">
              <div className="mb-3 text-sm font-medium">Rent details</div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium">Monthly charges (EUR)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    inputMode="numeric"
                    value={chargesMonthlyText}
                    onChange={(e) => setChargesMonthlyText(e.target.value)}
                    disabled={isPending}
                    placeholder="e.g. 250"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Deposit (EUR)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    inputMode="numeric"
                    value={depositText}
                    onChange={(e) => setDepositText(e.target.value)}
                    disabled={isPending}
                    placeholder="e.g. 3600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Agency fees (EUR)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    inputMode="numeric"
                    value={feesAgencyText}
                    onChange={(e) => setFeesAgencyText(e.target.value)}
                    disabled={isPending}
                    placeholder="e.g. 1800"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {savedAt ? <p className="text-sm text-green-700">Saved: {savedAt}</p> : null}

          <p className="text-xs text-gray-500">
            Changing price automatically appends to price history. Search indexing updates automatically after save.
          </p>
        </div>
      </section>

      <MediaGalleryManager listingId={props.listing.id} initialMedia={props.initialMedia} />

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Price history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Date</th>
                <th className="py-2 text-left font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {props.priceHistory.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-600" colSpan={2}>
                    No price changes yet.
                  </td>
                </tr>
              ) : (
                props.priceHistory.map((p) => (
                  <tr key={`${p.createdAt}-${p.price}`} className="border-b">
                    <td className="py-2">
                      {mounted ? new Date(p.createdAt).toLocaleString() : ""}
                    </td>
                    <td className="py-2">{p.price.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
