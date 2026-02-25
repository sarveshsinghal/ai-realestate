"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";

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

const PROPERTY_TYPES: PropertyType[] = [
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
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type NewListingFormState = {
  ok: boolean;
  message?: string | null;
  fieldErrors?: Partial<Record<"title" | "commune" | "price" | "sizeSqm", string>>;
  values?: Partial<{
    title: string;
    commune: string;
    kind: ListingKind;
    propertyType: PropertyType;
    price: string;
    sizeSqm: string;
    bedrooms: string;
    bathrooms: string;
  }>;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(
        "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5",
        "text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
      )}
    >
      {pending ? "Creating…" : "Create & open editor →"}
    </button>
  );
}

export default function NewListingForm({
  action,
  initial,
}: {
  action: (prev: NewListingFormState, formData: FormData) => Promise<NewListingFormState>;
  initial?: Partial<NewListingFormState["values"]>;
}) {
  const [state, formAction] = useFormState(action, {
    ok: true,
    message: null,
    fieldErrors: {},
    values: {
      title: initial?.title ?? "",
      commune: initial?.commune ?? "",
      kind: (initial?.kind ?? "SALE") as ListingKind,
      propertyType: (initial?.propertyType ?? "APARTMENT") as PropertyType,
      price: initial?.price ?? "",
      sizeSqm: initial?.sizeSqm ?? "50",
      bedrooms: initial?.bedrooms ?? "1",
      bathrooms: initial?.bathrooms ?? "1",
    },
  });

  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      {state.message ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Title *</label>
          <input
            name="title"
            defaultValue={v.title ?? ""}
            placeholder="e.g. Bright 2-bedroom in Kirchberg"
            className={cx(
              "mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm",
              fe.title ? "border-rose-300" : ""
            )}
          />
          <div className={cx("mt-1 text-xs", fe.title ? "text-rose-700" : "text-muted-foreground")}>
            {fe.title ?? "Required."}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Commune *</label>
          <input
            name="commune"
            defaultValue={v.commune ?? ""}
            placeholder="e.g. Luxembourg, Strassen, Hesperange"
            className={cx(
              "mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm",
              fe.commune ? "border-rose-300" : ""
            )}
          />
          <div className={cx("mt-1 text-xs", fe.commune ? "text-rose-700" : "text-muted-foreground")}>
            {fe.commune ?? "Required."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Kind</label>
          <select
            name="kind"
            defaultValue={(v.kind ?? "SALE") as string}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          >
            <option value="SALE">SALE</option>
            <option value="RENT">RENT</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Property type</label>
          <select
            name="propertyType"
            defaultValue={(v.propertyType ?? "APARTMENT") as string}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          >
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>
                {p.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Price (EUR)</label>
          <input
            name="price"
            inputMode="numeric"
            defaultValue={v.price ?? ""}
            placeholder="0 = Price on request"
            className={cx(
              "mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm",
              fe.price ? "border-rose-300" : ""
            )}
          />
          <div className={cx("mt-1 text-xs", fe.price ? "text-rose-700" : "text-muted-foreground")}>
            {fe.price ?? "Schema requires price. Use 0 for “on request”."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Size (sqm)</label>
          <input
            name="sizeSqm"
            inputMode="numeric"
            defaultValue={v.sizeSqm ?? "50"}
            className={cx(
              "mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm",
              fe.sizeSqm ? "border-rose-300" : ""
            )}
          />
          <div className={cx("mt-1 text-xs", fe.sizeSqm ? "text-rose-700" : "text-muted-foreground")}>
            {fe.sizeSqm ?? "Minimum 1."}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Bedrooms</label>
          <input
            name="bedrooms"
            inputMode="numeric"
            defaultValue={v.bedrooms ?? "1"}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Bathrooms</label>
          <input
            name="bathrooms"
            inputMode="numeric"
            defaultValue={v.bathrooms ?? "1"}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Creates a <span className="font-medium text-foreground">draft</span> listing and opens the editor.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
