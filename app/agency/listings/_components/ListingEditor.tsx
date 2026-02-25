// app/agency/listings/_components/ListingEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
type HeatingType =
  | "GAS"
  | "ELECTRIC"
  | "HEATPUMP"
  | "OIL"
  | "DISTRICT"
  | "WOOD"
  | "OTHER";

type ListingStatus = "ACTIVE" | "SOLD" | "UNAVAILABLE" | "ARCHIVED";

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

    // ✅ lifecycle
    status: ListingStatus;
    soldReason: string | null;
    soldAt: string | null; // ISO string
    archivedAt: string | null; // ISO string

    availableFrom: string | null; // ISO string
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

function toYyyyMmDd(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatCurrencyEUR(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} EUR`;
  }
}

function formatCompactNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

function normalizeIntegerText(
  raw: string,
  opts: { allowNegative: boolean; clampMin?: number }
): string {
  const t = raw.trim();
  if (!t) return "";
  const stripped = t.replace(/[^\d-]/g, "");
  if (!stripped) return "";

  const normalized = opts.allowNegative
    ? stripped.replace(/(?!^)-/g, "")
    : stripped.replace(/-/g, "");

  if (!normalized || normalized === "-" || normalized === "--") return "";
  const n = Number(normalized);
  if (!Number.isFinite(n)) return "";

  let v = Math.floor(n);
  if (typeof opts.clampMin === "number") v = Math.max(opts.clampMin, v);
  if (!opts.allowNegative) v = Math.max(0, v);

  return String(v);
}

type SectionKey = "details" | "amenities" | "media" | "pricing" | "history" | "seo";

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "details", label: "Details" },
  { key: "amenities", label: "Amenities" },
  { key: "media", label: "Media" },
  { key: "pricing", label: "Pricing" },
  { key: "history", label: "History" },
  { key: "seo", label: "SEO" },
];

type FieldKey = "title" | "commune" | "sizeSqm";

type FieldShellProps = {
  label: string;
  required?: boolean;
  hint?: string;
  rightHint?: string;
  error?: string | null;
  showError?: boolean;
  children: React.ReactNode;
};

function FieldShell(props: FieldShellProps) {
  const showError = Boolean(props.showError && props.error);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-gray-900">
          {props.label}
          {props.required ? <span className="ml-1 text-red-600">*</span> : null}
        </label>
        {props.rightHint ? (
          <span className="text-xs text-gray-400">{props.rightHint}</span>
        ) : null}
      </div>

      <div className="mt-1">{props.children}</div>

      {showError ? (
        <p className="mt-1 text-xs text-red-600">{props.error}</p>
      ) : props.hint ? (
        <p className="mt-1 text-xs text-gray-500">{props.hint}</p>
      ) : null}
    </div>
  );
}

type InputBaseProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  onBlur?: () => void;
  error?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

function TextInput(props: InputBaseProps) {
  return (
    <input
      ref={props.inputRef as any}
      className={cx(
        "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-black/10",
        props.error ? "border-red-300" : "border-gray-200",
        props.disabled ? "opacity-70" : ""
      )}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
      inputMode={props.inputMode}
      type={props.type}
      onBlur={props.onBlur}
    />
  );
}

type TextAreaProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
};

function TextArea(props: TextAreaProps) {
  return (
    <textarea
      className={cx(
        "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-black/10",
        props.disabled ? "opacity-70" : ""
      )}
      rows={props.rows ?? 6}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  );
}

type SelectFieldProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  options: Array<{ value: T; label: string }>;
};

function SelectField<T extends string>(props: SelectFieldProps<T>) {
  return (
    <select
      className={cx(
        "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-black/10",
        props.disabled ? "opacity-70" : ""
      )}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T)}
      disabled={props.disabled}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type OptionalSelectFieldProps<T extends string> = {
  value: T | "";
  onChange: (next: T | "") => void;
  disabled?: boolean;
  placeholderLabel: string;
  options: Array<{ value: T; label: string }>;
};

function OptionalSelectField<T extends string>(props: OptionalSelectFieldProps<T>) {
  return (
    <select
      className={cx(
        "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-black/10",
        props.disabled ? "opacity-70" : ""
      )}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T | "")}
      disabled={props.disabled}
    >
      <option value="">{props.placeholderLabel}</option>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type CheckboxCardProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

function CheckboxCard(props: CheckboxCardProps) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        disabled={props.disabled}
      />
      {props.label}
    </label>
  );
}

export default function ListingEditor(props: ListingEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Sticky UI
  const [activeSection, setActiveSection] = useState<SectionKey>("details");

  const sectionRefs = useRef<Record<SectionKey, HTMLElement | null>>({
    details: null,
    amenities: null,
    media: null,
    pricing: null,
    history: null,
    seo: null,
  });

  // Required field input refs (for focus + scroll)
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const communeInputRef = useRef<HTMLInputElement | null>(null);
  const sizeSqmInputRef = useRef<HTMLInputElement | null>(null);

  // Publish state (local UI mirror)
  const [isPublished, setIsPublished] = useState<boolean>(
    Boolean(props.listing.isPublished)
  );

  // Basics
  const [title, setTitle] = useState(props.listing.title);
  const [description, setDescription] = useState(props.listing.description ?? "");
  const [commune, setCommune] = useState(props.listing.commune);
  const [addressHint, setAddressHint] = useState(props.listing.addressHint ?? "");

  const [kind, setKind] = useState<ListingKind>(props.listing.kind);
  const [propertyType, setPropertyType] = useState<PropertyType>(
    props.listing.propertyType
  );

  // Numbers as text for controlled inputs
  const [priceText, setPriceText] = useState(
    props.listing.price == null ? "" : String(props.listing.price)
  );
  const [sizeSqmText, setSizeSqmText] = useState(String(props.listing.sizeSqm ?? 0));
  const [bedroomsText, setBedroomsText] = useState(String(props.listing.bedrooms ?? 0));
  const [bathroomsText, setBathroomsText] = useState(String(props.listing.bathrooms ?? 0));
  const [parkingSpacesText, setParkingSpacesText] = useState(
    props.listing.parkingSpaces == null ? "" : String(props.listing.parkingSpaces)
  );

  const [yearBuiltText, setYearBuiltText] = useState(
    props.listing.yearBuilt == null ? "" : String(props.listing.yearBuilt)
  );
  const [floorText, setFloorText] = useState(
    props.listing.floor == null ? "" : String(props.listing.floor)
  );
  const [totalFloorsText, setTotalFloorsText] = useState(
    props.listing.totalFloors == null ? "" : String(props.listing.totalFloors)
  );

  const [condition, setCondition] = useState<ListingCondition>(props.listing.condition);
  const [energyClass, setEnergyClass] = useState<EnergyClass>(props.listing.energyClass);
  const [heatingType, setHeatingType] = useState<HeatingType | "">(
    props.listing.heatingType ?? ""
  );

  // ✅ lifecycle (agency-facing)
  const [lifecycleStatus, setLifecycleStatus] = useState<ListingStatus>(
    props.listing.status ?? "ACTIVE"
  );
  const [soldReason, setSoldReason] = useState<string>(props.listing.soldReason ?? "");
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const soldAtLabel = useMemo(() => {
    if (!props.listing.soldAt) return "—";
    const d = new Date(props.listing.soldAt);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }, [props.listing.soldAt]);

  const archivedAtLabel = useMemo(() => {
    if (!props.listing.archivedAt) return "—";
    const d = new Date(props.listing.archivedAt);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }, [props.listing.archivedAt]);

  // Rent fields
  const [chargesMonthlyText, setChargesMonthlyText] = useState(
    props.listing.chargesMonthly == null ? "" : String(props.listing.chargesMonthly)
  );
  const [depositText, setDepositText] = useState(
    props.listing.deposit == null ? "" : String(props.listing.deposit)
  );
  const [feesAgencyText, setFeesAgencyText] = useState(
    props.listing.feesAgency == null ? "" : String(props.listing.feesAgency)
  );

  // Dates (YYYY-MM-DD for HTML date input)
  const [availableFrom, setAvailableFrom] = useState<string>(() =>
    toYyyyMmDd(props.listing.availableFrom)
  );

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
  const [publishBusy, setPublishBusy] = useState(false);

  // “Premium” save status UX
  const [lastSavedAtLocal, setLastSavedAtLocal] = useState<number | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);

  // Per-field touched
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    title: false,
    commune: false,
    sizeSqm: false,
  });

  // Autosave architecture (design-only, disabled)
  const AUTOSAVE_ENABLED = false;

  // Used by navigation guards (avoid stale closures)
  const isDirtyRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Keep publish status in sync if server refreshes the page
  useEffect(() => {
    setIsPublished(Boolean(props.listing.isPublished));
  }, [props.listing.isPublished]);

  // Keep lifecycle status & soldReason in sync after refresh
  useEffect(() => {
    setLifecycleStatus(props.listing.status ?? "ACTIVE");
    setSoldReason(props.listing.soldReason ?? "");
  }, [props.listing.status, props.listing.soldReason]);

  // Section observer (sticky tabs highlight)
  useEffect(() => {
    const nodes: Array<{ key: SectionKey; el: HTMLElement }> = SECTIONS.map((s) => ({
      key: s.key,
      el: sectionRefs.current[s.key],
    })).filter((x): x is { key: SectionKey; el: HTMLElement } => Boolean(x.el));

    if (nodes.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) =>
            a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1
          );

        const topMost = visible[0];
        if (!topMost) return;

        const key = (topMost.target as HTMLElement).dataset.sectionKey as
          | SectionKey
          | undefined;
        if (key) setActiveSection(key);
      },
      {
        root: null,
        threshold: 0.2,
        rootMargin: "-120px 0px -70% 0px",
      }
    );

    for (const n of nodes) obs.observe(n.el);
    return () => obs.disconnect();
  }, []);

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

    const availableFromIso = availableFrom.trim()
      ? new Date(`${availableFrom}T00:00:00`).toISOString()
      : null;

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

  // Dirty tracking (UI only)
  const isDirty = useMemo(() => {
    const initial = props.listing;

    const initialTitle = initial.title ?? "";
    const initialDescription = initial.description ?? "";
    const initialCommune = initial.commune ?? "";
    const initialAddressHint = initial.addressHint ?? "";

    const initialPriceText = initial.price == null ? "" : String(initial.price);
    const initialSizeSqmText = String(initial.sizeSqm ?? 0);
    const initialBedroomsText = String(initial.bedrooms ?? 0);
    const initialBathroomsText = String(initial.bathrooms ?? 0);
    const initialParkingSpacesText =
      initial.parkingSpaces == null ? "" : String(initial.parkingSpaces);

    const initialYearBuiltText =
      initial.yearBuilt == null ? "" : String(initial.yearBuilt);
    const initialFloorText = initial.floor == null ? "" : String(initial.floor);
    const initialTotalFloorsText =
      initial.totalFloors == null ? "" : String(initial.totalFloors);

    const initialChargesMonthlyText =
      initial.chargesMonthly == null ? "" : String(initial.chargesMonthly);
    const initialDepositText = initial.deposit == null ? "" : String(initial.deposit);
    const initialFeesAgencyText =
      initial.feesAgency == null ? "" : String(initial.feesAgency);

    const initialAvailableFrom = toYyyyMmDd(initial.availableFrom);

    const changed =
      title !== initialTitle ||
      description !== initialDescription ||
      commune !== initialCommune ||
      addressHint !== initialAddressHint ||
      kind !== initial.kind ||
      propertyType !== initial.propertyType ||
      priceText !== initialPriceText ||
      sizeSqmText !== initialSizeSqmText ||
      bedroomsText !== initialBedroomsText ||
      bathroomsText !== initialBathroomsText ||
      parkingSpacesText !== initialParkingSpacesText ||
      condition !== initial.condition ||
      energyClass !== initial.energyClass ||
      heatingType !== (initial.heatingType ?? "") ||
      yearBuiltText !== initialYearBuiltText ||
      floorText !== initialFloorText ||
      totalFloorsText !== initialTotalFloorsText ||
      availableFrom !== initialAvailableFrom ||
      furnished !== Boolean(initial.furnished) ||
      petsAllowed !== Boolean(initial.petsAllowed) ||
      hasElevator !== Boolean(initial.hasElevator) ||
      hasBalcony !== Boolean(initial.hasBalcony) ||
      hasTerrace !== Boolean(initial.hasTerrace) ||
      hasGarden !== Boolean(initial.hasGarden) ||
      hasCellar !== Boolean(initial.hasCellar) ||
      chargesMonthlyText !== initialChargesMonthlyText ||
      depositText !== initialDepositText ||
      feesAgencyText !== initialFeesAgencyText ||
      lifecycleStatus !== initial.status ||
      soldReason.trim() !== (initial.soldReason ?? "").trim();

    return changed;
  }, [
    props.listing,
    title,
    description,
    commune,
    addressHint,
    kind,
    propertyType,
    priceText,
    sizeSqmText,
    bedroomsText,
    bathroomsText,
    parkingSpacesText,
    condition,
    energyClass,
    heatingType,
    yearBuiltText,
    floorText,
    totalFloorsText,
    availableFrom,
    furnished,
    petsAllowed,
    hasElevator,
    hasBalcony,
    hasTerrace,
    hasGarden,
    hasCellar,
    chargesMonthlyText,
    depositText,
    feesAgencyText,
    lifecycleStatus,
    soldReason,
  ]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const fieldErrors = useMemo(() => {
    const titleErr = !title.trim() ? "Title is required." : null;
    const communeErr = !commune.trim() ? "Commune is required." : null;
    const sizeErr =
      parsed.sizeSqm == null || parsed.sizeSqm <= 0
        ? "Size (sqm) must be a positive number."
        : null;

    return {
      title: titleErr,
      commune: communeErr,
      sizeSqm: sizeErr,
    };
  }, [title, commune, parsed.sizeSqm]);

  const shouldShowError = useMemo(() => {
    const base = saveAttempted;
    return {
      title: base || touched.title,
      commune: base || touched.commune,
      sizeSqm: base || touched.sizeSqm,
    };
  }, [saveAttempted, touched]);

  const saveStatus = useMemo(() => {
    if (isPending) return { label: "Saving…", tone: "neutral" as const };
    if (error) return { label: "Save failed", tone: "danger" as const };
    if (isDirty) return { label: "Unsaved changes", tone: "warning" as const };
    if (lastSavedAtLocal != null || savedAt != null)
      return { label: "Saved", tone: "success" as const };
    return { label: "Saved", tone: "success" as const };
  }, [isPending, error, isDirty, lastSavedAtLocal, savedAt]);

  const validationCountBySection = useMemo(() => {
    const detailsCount =
      (fieldErrors.title ? 1 : 0) +
      (fieldErrors.commune ? 1 : 0) +
      (fieldErrors.sizeSqm ? 1 : 0);

    return {
      details: detailsCount,
      amenities: 0,
      media: 0,
      pricing: 0,
      history: 0,
      seo: 0,
    } satisfies Record<SectionKey, number>;
  }, [fieldErrors]);

  const hasBlockingValidation = Boolean(
    fieldErrors.title || fieldErrors.commune || fieldErrors.sizeSqm
  );

  // Autosave scaffold (disabled)
  useEffect(() => {
    if (!AUTOSAVE_ENABLED) return;
    if (!isDirty) return;
    if (isPending) return;

    const id = window.setTimeout(() => {
      void saveAll();
    }, 1200);

    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [AUTOSAVE_ENABLED, isDirty]);

  // Cmd/Ctrl+S support
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== "s") return;

      e.preventDefault();
      if (isPending) return;
      if (!isDirtyRef.current) return;

      void saveAll();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  // Refresh/close/tab guard
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Browser back guard (popstate)
  useEffect(() => {
    function ensureGuardState() {
      try {
        window.history.pushState({ __listingEditorGuard: true }, "", window.location.href);
      } catch {
        // no-op
      }
    }

    function onPopState() {
      if (!isDirtyRef.current) return;

      const ok = window.confirm("You have unsaved changes. Leave this page?");
      if (ok) return;

      ensureGuardState();
    }

    ensureGuardState();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function scrollToSection(key: SectionKey) {
    const el = sectionRefs.current[key];
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY - 128;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function focusAndScrollTo(el: HTMLElement | null, section: SectionKey) {
    scrollToSection(section);
    if (!el) return;
    window.setTimeout(() => {
      try {
        (el as any).focus?.();
      } catch {
        // no-op
      }
    }, 250);
  }

  function goToFirstInvalid() {
    if (fieldErrors.title) {
      focusAndScrollTo(titleInputRef.current, "details");
      return;
    }
    if (fieldErrors.commune) {
      focusAndScrollTo(communeInputRef.current, "details");
      return;
    }
    if (fieldErrors.sizeSqm) {
      focusAndScrollTo(sizeSqmInputRef.current, "details");
      return;
    }
  }

  function confirmNavigateAway(): boolean {
    if (!isDirtyRef.current) return true;
    return window.confirm("You have unsaved changes. Leave this page?");
  }

  function goBackToListings() {
    if (!confirmNavigateAway()) return;
    router.push("/agency/listings");
  }

  async function updateLifecycleStatus() {
    setError(null);
    setLifecycleBusy(true);

    try {
      const fd = new FormData();
      fd.set("status", lifecycleStatus);
      if (soldReason.trim()) fd.set("soldReason", soldReason.trim());

      const res = await fetch(`/api/listings/${props.listing.id}/status`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? "Failed to update lifecycle status");
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      setError("Network error while updating lifecycle status");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function saveAll() {
    setSaveAttempted(true);
    setError(null);
    setSavedAt(null);

    // ensure required errors are visible
    setTouched({ title: true, commune: true, sizeSqm: true });

    if (fieldErrors.title || fieldErrors.commune || fieldErrors.sizeSqm) {
      setError("Please fix the highlighted fields before saving.");
      goToFirstInvalid();
      return;
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      commune: commune.trim(),
      addressHint: addressHint.trim() ? addressHint.trim() : null,

      kind,
      propertyType,

      // allow null (empty) price
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

      // rent fields only meaningful for RENT
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

    setLastSavedAtLocal(Date.now());
    setSavedAt(new Date().toLocaleString());
    startTransition(() => router.refresh());
  }

  async function togglePublish() {
    setError(null);
    setPublishBusy(true);

    try {
      const res = await fetch(`/api/agency/listings/${props.listing.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? "Failed to update publish status");
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { id?: string; isPublished?: boolean }
        | null;

      if (typeof data?.isPublished === "boolean") {
        setIsPublished(data.isPublished);
      } else {
        setIsPublished((v) => !v);
      }

      startTransition(() => router.refresh());
    } finally {
      setPublishBusy(false);
    }
  }

  const headerBadgeClass =
    isPublished
      ? "bg-green-50 text-green-700 border border-green-200"
      : "bg-yellow-50 text-yellow-700 border border-yellow-200";

  const savePillClass =
    saveStatus.tone === "success"
      ? "bg-green-50 text-green-700 border border-green-200"
      : saveStatus.tone === "warning"
      ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
      : saveStatus.tone === "danger"
      ? "bg-red-50 text-red-700 border border-red-200"
      : "bg-gray-50 text-gray-700 border border-gray-200";

  const publishDisabledReason = useMemo(() => {
    if (isPending || publishBusy) return "Publishing is busy. Please wait.";
    if (lifecycleStatus !== "ACTIVE")
      return "Only ACTIVE listings can be published. Change lifecycle status to ACTIVE.";
    if (hasBlockingValidation)
      return "Fix required fields (Title, Commune, Size) before publishing.";
    if (isDirty) return "Save changes before publishing.";
    return null;
  }, [isPending, publishBusy, lifecycleStatus, hasBlockingValidation, isDirty]);

  const publishDisabled = Boolean(publishDisabledReason);

  return (
    <div className="space-y-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100"
                  onClick={goBackToListings}
                >
                  ← Back to Listings
                </button>

                <span className={cx("rounded-full px-2 py-1 text-xs font-medium", headerBadgeClass)}>
                  {isPublished ? "Published" : "Draft"}
                </span>

                <span className={cx("rounded-full px-2 py-1 text-xs font-medium", savePillClass)}>
                  {saveStatus.label}
                </span>

                <span className="hidden text-xs text-gray-500 md:inline">
                  Tip: Press <span className="font-medium">Ctrl/⌘ + S</span> to save
                </span>
              </div>

              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-gray-900">
                    {title.trim() ? title.trim() : "Untitled listing"}
                  </h1>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Listing ID: <span className="font-mono">{props.listing.id}</span>
                    {savedAt ? (
                      <>
                        {" "}
                        · Last saved: <span className="text-gray-700">{savedAt}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className={cx(
                      "rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60",
                      isPublished
                        ? "bg-gray-800 hover:bg-gray-900"
                        : "bg-green-600 hover:bg-green-700",
                      publishDisabled ? "cursor-not-allowed opacity-60" : ""
                    )}
                    onClick={() => void togglePublish()}
                    disabled={publishDisabled}
                    title={
                      publishDisabledReason ??
                      "Publish makes the listing visible publicly and eligible for matching/search."
                    }
                  >
                    {publishBusy ? "Updating…" : isPublished ? "Unpublish" : "Publish"}
                  </button>

                  <button
                    className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                    onClick={() => void saveAll()}
                    disabled={isPending || !isDirty}
                    title={!isDirty ? "No changes to save" : "Save changes"}
                  >
                    {isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {publishDisabledReason ? (
                <div className="mt-2 text-xs text-gray-500">
                  Publishing: <span className="font-medium">{publishDisabledReason}</span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-500">
                  Publishing makes the listing public and eligible for matching/search.
                </div>
              )}

              {error ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Sticky tabs */}
        <div className="border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center gap-2 overflow-x-auto py-2">
              {SECTIONS.map((s) => {
                const active = activeSection === s.key;
                const count = validationCountBySection[s.key] ?? 0;

                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => scrollToSection(s.key)}
                    className={cx(
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium",
                      active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                    )}
                    title={count > 0 ? `${count} required field(s) to fix` : undefined}
                  >
                    {s.label}
                    {count > 0 ? (
                      <span
                        className={cx(
                          "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                          active ? "bg-white/20 text-white" : "bg-red-50 text-red-700"
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              <div className="ml-auto hidden items-center gap-2 md:flex">
                <span className="text-xs text-gray-500">
                  {isDirty ? "Changes not saved" : "Up to date"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl space-y-8 px-4 pb-10">
        {/* DETAILS */}
        <section
          ref={(el) => {
            sectionRefs.current.details = el;
          }}
          data-section-key="details"
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Details</h2>
              <p className="mt-1 text-sm text-gray-600">
                Core listing information used for search, preview, and agency exports.
              </p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <span className="text-xs text-gray-500">
                Price preview:{" "}
                <span className="font-medium text-gray-800">
                  {formatCurrencyEUR(parsed.price)}
                  {kind === "RENT" ? " / mo" : ""}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            <FieldShell
              label="Title"
              required
              rightHint={`${title.trim().length}/120`}
              hint="Keep it short and specific."
              error={fieldErrors.title}
              showError={shouldShowError.title}
            >
              <TextInput
                inputRef={titleInputRef}
                value={title}
                onChange={setTitle}
                disabled={isPending}
                placeholder="e.g. Bright 2-bedroom apartment in Kirchberg"
                error={Boolean(shouldShowError.title && fieldErrors.title)}
                onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              />
            </FieldShell>

            <FieldShell
              label="Description"
              hint="Tip: Mention transport, schools, parking, and renovation status."
            >
              <TextArea
                value={description}
                onChange={setDescription}
                disabled={isPending}
                placeholder="Describe the property, neighborhood, highlights, etc."
                rows={6}
              />
            </FieldShell>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Listing type" hint="Affects pricing fields and public display.">
                <SelectField<ListingKind>
                  value={kind}
                  onChange={setKind}
                  disabled={isPending}
                  options={[
                    { value: "SALE", label: "Sale" },
                    { value: "RENT", label: "Rent" },
                  ]}
                />
              </FieldShell>

              <FieldShell label="Property type">
                <SelectField<PropertyType>
                  value={propertyType}
                  onChange={setPropertyType}
                  disabled={isPending}
                  options={[
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
                  ].map((v) => ({ value: v as PropertyType, label: v.replaceAll("_", " ") }))}
                />
              </FieldShell>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell
                label="Commune"
                required
                hint="Used for filters and search relevance."
                error={fieldErrors.commune}
                showError={shouldShowError.commune}
              >
                <TextInput
                  inputRef={communeInputRef}
                  value={commune}
                  onChange={setCommune}
                  disabled={isPending}
                  placeholder="e.g. Luxembourg, Strassen, Hesperange"
                  error={Boolean(shouldShowError.commune && fieldErrors.commune)}
                  onBlur={() => setTouched((t) => ({ ...t, commune: true }))}
                />
              </FieldShell>

              <FieldShell
                label="Address hint"
                hint="Optional public-friendly location hint (no exact address)."
              >
                <TextInput
                  value={addressHint}
                  onChange={setAddressHint}
                  disabled={isPending}
                  placeholder="e.g. Kirchberg / near European School"
                />
              </FieldShell>
            </div>

            {/* ✅ Lifecycle */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900">Lifecycle</p>
                <p className="text-xs text-gray-500">
                  Use this to mark listings as sold/unavailable. Only{" "}
                  <span className="font-medium">ACTIVE</span> listings can be published.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FieldShell
                  label="Status"
                  hint="ACTIVE = available. SOLD/UNAVAILABLE hide it from public grids & AI search."
                >
                  <SelectField<ListingStatus>
                    value={lifecycleStatus}
                    onChange={setLifecycleStatus}
                    disabled={isPending || publishBusy || lifecycleBusy}
                    options={[
                      { value: "ACTIVE", label: "ACTIVE (Available)" },
                      { value: "SOLD", label: "SOLD" },
                      { value: "UNAVAILABLE", label: "UNAVAILABLE" },
                      { value: "ARCHIVED", label: "ARCHIVED" },
                    ]}
                  />
                </FieldShell>

                <FieldShell label="Sold at">
                  <TextInput value={soldAtLabel} onChange={() => {}} disabled />
                </FieldShell>

                <FieldShell label="Archived at">
                  <TextInput value={archivedAtLabel} onChange={() => {}} disabled />
                </FieldShell>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FieldShell
                  label="Reason (optional)"
                  hint='Examples: "sold", "rented", "withdrawn".'
                >
                  <TextInput
                    value={soldReason}
                    onChange={setSoldReason}
                    disabled={isPending || lifecycleBusy}
                    placeholder='e.g. "sold"'
                  />
                </FieldShell>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void updateLifecycleStatus()}
                    disabled={isPending || lifecycleBusy}
                    className={cx(
                      "w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60",
                      "bg-neutral-900 hover:bg-neutral-800"
                    )}
                    title="Update lifecycle status"
                  >
                    {lifecycleBusy ? "Updating…" : "Update status"}
                  </button>
                </div>
              </div>

              {lifecycleStatus !== "ACTIVE" ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This listing is <span className="font-medium">{lifecycleStatus}</span>. Publishing is disabled.
                </div>
              ) : null}
            </div>

            {/* Core metrics */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Core metrics</p>
                  <p className="text-xs text-gray-500">Used prominently in cards and search.</p>
                </div>
                <div className="text-xs text-gray-500">
                  Size preview:{" "}
                  <span className="font-medium text-gray-800">
                    {parsed.sizeSqm != null ? `${formatCompactNumber(parsed.sizeSqm)} m²` : "—"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <FieldShell
                  label={kind === "RENT" ? "Rent (EUR / mo)" : "Price (EUR)"}
                  hint={
                    kind === "RENT"
                      ? `Preview: ${formatCurrencyEUR(parsed.price)} / mo`
                      : `Preview: ${formatCurrencyEUR(parsed.price)}`
                  }
                >
                  <TextInput
                    value={priceText}
                    onChange={setPriceText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder={kind === "RENT" ? "e.g. 2600" : "e.g. 750000"}
                    onBlur={() =>
                      setPriceText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: false })
                      )
                    }
                  />
                </FieldShell>

                <FieldShell
                  label="Size (sqm)"
                  required
                  hint="Required."
                  error={fieldErrors.sizeSqm}
                  showError={shouldShowError.sizeSqm}
                >
                  <TextInput
                    inputRef={sizeSqmInputRef}
                    value={sizeSqmText}
                    onChange={setSizeSqmText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder="e.g. 85"
                    error={Boolean(shouldShowError.sizeSqm && fieldErrors.sizeSqm)}
                    onBlur={() => {
                      setTouched((t) => ({ ...t, sizeSqm: true }));
                      setSizeSqmText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                      );
                    }}
                  />
                </FieldShell>

                <FieldShell label="Bedrooms">
                  <TextInput
                    value={bedroomsText}
                    onChange={setBedroomsText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder="e.g. 2"
                    onBlur={() =>
                      setBedroomsText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                      )
                    }
                  />
                </FieldShell>

                <FieldShell label="Bathrooms">
                  <TextInput
                    value={bathroomsText}
                    onChange={setBathroomsText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder="e.g. 1"
                    onBlur={() =>
                      setBathroomsText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                      )
                    }
                  />
                </FieldShell>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FieldShell label="Condition">
                <SelectField<ListingCondition>
                  value={condition}
                  onChange={setCondition}
                  disabled={isPending}
                  options={["NEW", "RENOVATED", "GOOD", "TO_RENOVATE"].map((v) => ({
                    value: v as ListingCondition,
                    label: v.replaceAll("_", " "),
                  }))}
                />
              </FieldShell>

              <FieldShell label="Energy class">
                <SelectField<EnergyClass>
                  value={energyClass}
                  onChange={setEnergyClass}
                  disabled={isPending}
                  options={["A", "B", "C", "D", "E", "F"].map((v) => ({
                    value: v as EnergyClass,
                    label: v,
                  }))}
                />
              </FieldShell>

              <FieldShell label="Heating type" hint="Optional; improves buyer/tenant confidence.">
                <OptionalSelectField<HeatingType>
                  value={heatingType}
                  onChange={setHeatingType}
                  disabled={isPending}
                  placeholderLabel="(not specified)"
                  options={["GAS", "ELECTRIC", "HEATPUMP", "OIL", "DISTRICT", "WOOD", "OTHER"].map(
                    (v) => ({
                      value: v as HeatingType,
                      label: v.replaceAll("_", " "),
                    })
                  )}
                />
              </FieldShell>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900">Building</p>
                <p className="text-xs text-gray-500">
                  Optional details that improve ranking and matching quality.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <FieldShell label="Year built">
                  <TextInput
                    value={yearBuiltText}
                    onChange={setYearBuiltText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder="e.g. 2012"
                    onBlur={() =>
                      setYearBuiltText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                      )
                    }
                  />
                </FieldShell>

                <FieldShell label="Floor" hint="Basement can be -1 if you use that convention.">
                  <TextInput
                    value={floorText}
                    onChange={setFloorText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder="e.g. 3"
                    onBlur={() =>
                      setFloorText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: true })
                      )
                    }
                  />
                </FieldShell>

                <FieldShell label="Total floors">
                  <TextInput
                    value={totalFloorsText}
                    onChange={setTotalFloorsText}
                    disabled={isPending}
                    inputMode="numeric"
                    placeholder="e.g. 6"
                    onBlur={() =>
                      setTotalFloorsText((cur) =>
                        normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                      )
                    }
                  />
                </FieldShell>

                <FieldShell label="Available from" hint="Leave empty if flexible / unknown.">
                  <TextInput
                    value={availableFrom}
                    onChange={setAvailableFrom}
                    disabled={isPending}
                    type="date"
                  />
                </FieldShell>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Price changes append to history. Search indexing updates automatically after save/publish.
            </p>
          </div>
        </section>

        {/* AMENITIES */}
        <section
          ref={(el) => {
            sectionRefs.current.amenities = el;
          }}
          data-section-key="amenities"
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="text-base font-semibold text-gray-900">Amenities</h2>
            <p className="mt-1 text-sm text-gray-600">
              Select only what’s confirmed — it improves trust and conversion.
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <CheckboxCard label="Furnished" checked={furnished} onChange={setFurnished} disabled={isPending} />
              <CheckboxCard label="Pets allowed" checked={petsAllowed} onChange={setPetsAllowed} disabled={isPending} />
              <CheckboxCard label="Elevator" checked={hasElevator} onChange={setHasElevator} disabled={isPending} />
              <CheckboxCard label="Balcony" checked={hasBalcony} onChange={setHasBalcony} disabled={isPending} />
              <CheckboxCard label="Terrace" checked={hasTerrace} onChange={setHasTerrace} disabled={isPending} />
              <CheckboxCard label="Garden" checked={hasGarden} onChange={setHasGarden} disabled={isPending} />
              <CheckboxCard label="Cellar" checked={hasCellar} onChange={setHasCellar} disabled={isPending} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FieldShell label="Parking spaces" hint={`Preview: ${parsed.parkingSpaces ?? 0}`}>
                <TextInput
                  value={parkingSpacesText}
                  onChange={setParkingSpacesText}
                  disabled={isPending}
                  inputMode="numeric"
                  placeholder="e.g. 1"
                  onBlur={() =>
                    setParkingSpacesText((cur) =>
                      normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                    )
                  }
                />
              </FieldShell>
            </div>
          </div>
        </section>

        {/* MEDIA */}
        <section
          ref={(el) => {
            sectionRefs.current.media = el;
          }}
          data-section-key="media"
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Media</h2>
              <p className="mt-1 text-sm text-gray-600">
                Upload high-quality images first. Reorder so the best image is primary.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              {props.initialMedia.length} photo{props.initialMedia.length === 1 ? "" : "s"} (updates after refresh)
            </div>
          </div>

          <div className="mt-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <MediaGalleryManager listingId={props.listing.id} initialMedia={props.initialMedia} />
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section
          ref={(el) => {
            sectionRefs.current.pricing = el;
          }}
          data-section-key="pricing"
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Pricing</h2>
              <p className="mt-1 text-sm text-gray-600">
                Structured pricing improves clarity and reduces back-and-forth.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Preview:{" "}
              <span className="font-medium text-gray-800">
                {formatCurrencyEUR(parsed.price)}
                {kind === "RENT" ? " / mo" : ""}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {kind === "RENT" ? "Rent" : "Sale"} pricing
                </p>
                <span className="text-xs text-gray-500">{kind === "RENT" ? "Monthly" : "Total"}</span>
              </div>

              <FieldShell
                label={kind === "RENT" ? "Rent (EUR / mo)" : "Sale price (EUR)"}
                hint={
                  kind === "RENT"
                    ? `Display preview: ${formatCurrencyEUR(parsed.price)} / mo`
                    : `Display preview: ${formatCurrencyEUR(parsed.price)}`
                }
              >
                <TextInput
                  value={priceText}
                  onChange={setPriceText}
                  disabled={isPending}
                  inputMode="numeric"
                  placeholder={kind === "RENT" ? "e.g. 2600" : "e.g. 750000"}
                  onBlur={() =>
                    setPriceText((cur) =>
                      normalizeIntegerText(cur, { allowNegative: false })
                    )
                  }
                />
              </FieldShell>

              <p className="mt-3 text-xs text-gray-500">Tip: Leave empty for “Price on request”.</p>
            </div>

            {kind === "RENT" ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900">Rent details</p>
                  <p className="text-xs text-gray-500">Shown to tenants and used for filtering.</p>
                </div>

                <div className="grid gap-4">
                  <FieldShell label="Monthly charges (EUR)" hint={`Preview: ${formatCurrencyEUR(parsed.chargesMonthly)}`}>
                    <TextInput
                      value={chargesMonthlyText}
                      onChange={setChargesMonthlyText}
                      disabled={isPending}
                      inputMode="numeric"
                      placeholder="e.g. 250"
                      onBlur={() =>
                        setChargesMonthlyText((cur) =>
                          normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                        )
                      }
                    />
                  </FieldShell>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldShell label="Deposit (EUR)" hint={`Preview: ${formatCurrencyEUR(parsed.deposit)}`}>
                      <TextInput
                        value={depositText}
                        onChange={setDepositText}
                        disabled={isPending}
                        inputMode="numeric"
                        placeholder="e.g. 3600"
                        onBlur={() =>
                          setDepositText((cur) =>
                            normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                          )
                        }
                      />
                    </FieldShell>

                    <FieldShell label="Agency fees (EUR)" hint={`Preview: ${formatCurrencyEUR(parsed.feesAgency)}`}>
                      <TextInput
                        value={feesAgencyText}
                        onChange={setFeesAgencyText}
                        disabled={isPending}
                        inputMode="numeric"
                        placeholder="e.g. 1800"
                        onBlur={() =>
                          setFeesAgencyText((cur) =>
                            normalizeIntegerText(cur, { allowNegative: false, clampMin: 0 })
                          )
                        }
                      />
                    </FieldShell>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-900">Rent details</p>
                  <p className="text-xs text-gray-500">Not applicable for Sale listings.</p>
                </div>
                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                  Switch <span className="font-medium">Listing type</span> to{" "}
                  <span className="font-medium">Rent</span> to configure monthly charges, deposit, and fees.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* HISTORY */}
        <section
          ref={(el) => {
            sectionRefs.current.history = el;
          }}
          data-section-key="history"
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">History</h2>
              <p className="mt-1 text-sm text-gray-600">Price changes are tracked automatically after saves.</p>
            </div>
            <div className="text-xs text-gray-500">
              Entries:{" "}
              <span className="font-medium text-gray-800">{props.priceHistory.length}</span>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-medium text-gray-900">Date</th>
                  <th className="py-2 text-left font-medium text-gray-900">Price</th>
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
                    <tr key={`${p.createdAt}-${p.price}`} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">
                        {mounted ? new Date(p.createdAt).toLocaleString() : ""}
                      </td>
                      <td className="py-2 font-medium text-gray-900">{p.price.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SEO */}
        <section
          ref={(el) => {
            sectionRefs.current.seo = el;
          }}
          data-section-key="seo"
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="text-base font-semibold text-gray-900">SEO</h2>
            <p className="mt-1 text-sm text-gray-600">
              Future-ready placeholder for SEO title/description and structured data hints.
            </p>
          </div>

          <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">Coming soon</p>
            <p className="mt-1 text-sm text-gray-600">
              We’ll add SEO fields later without changing current behavior.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-gray-900">Editor status</p>
              <p className="text-xs text-gray-600">
                {isPending ? "Saving changes…" : isDirty ? "You have unsaved changes." : "All changes saved."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={cx(
                  "rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60",
                  isPublished ? "bg-gray-800 hover:bg-gray-900" : "bg-green-600 hover:bg-green-700",
                  publishDisabled ? "cursor-not-allowed opacity-60" : ""
                )}
                onClick={() => void togglePublish()}
                disabled={publishDisabled}
                title={publishDisabledReason ?? "Toggle publish status"}
              >
                {publishBusy ? "Updating…" : isPublished ? "Unpublish" : "Publish"}
              </button>

              <button
                className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                onClick={() => void saveAll()}
                disabled={isPending || !isDirty}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Keyboard shortcut: <span className="font-medium">Ctrl/⌘ + S</span> saves changes.
        </p>
      </div>
    </div>
  );
}