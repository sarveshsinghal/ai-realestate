// app/agency/leads/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import AutoSubmitSelect from "./_components/AutoSubmitSelect";

type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "VIEWING"
  | "OFFER"
  | "WON"
  | "LOST";

const STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "OFFER",
  "WON",
  "LOST",
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("de-LU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatEUR(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function statusPillClass(status: LeadStatus) {
  switch (status) {
    case "NEW":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "CONTACTED":
      return "border-indigo-200 bg-indigo-50 text-indigo-950";
    case "QUALIFIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "VIEWING":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "OFFER":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "WON":
      return "border-green-200 bg-green-50 text-green-950";
    case "LOST":
      return "border-rose-200 bg-rose-50 text-rose-950";
    default:
      return "border-border bg-muted text-foreground";
  }
}

function normalizeStatus(s: unknown): LeadStatus | "ALL" {
  if (s === "ALL") return "ALL";
  if (typeof s !== "string") return "ALL";
  const up = s.toUpperCase();
  return (STATUSES as string[]).includes(up) ? (up as LeadStatus) : "ALL";
}

function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

/**
 * Server action: secure, multi-tenant lead status updates.
 */
async function updateLeadStatus(formData: FormData) {
  "use server";

  const { agency } = await requireAgencyContext();

  const id = String(formData.get("id") ?? "").trim();
  const status = formData.get("status");
  const listingId = String(formData.get("listingId") ?? "").trim();

  if (!id) return;
  if (!isLeadStatus(status)) return;

  const lead = await prisma.lead.findFirst({
    where: { id, agencyId: agency.id },
    select: { id: true },
  });

  if (!lead) return;

  await prisma.lead.update({
    where: { id },
    data: { status },
    select: { id: true },
  });

  revalidatePath("/agency");
  revalidatePath("/agency/leads");
  if (listingId) revalidatePath("/agency/leads");
}

async function setLeadStatusQuick(formData: FormData) {
  "use server";

  const { agency } = await requireAgencyContext();

  const id = String(formData.get("id") ?? "").trim();
  const status = formData.get("status");
  const listingId = String(formData.get("listingId") ?? "").trim();

  if (!id) return;
  if (!isLeadStatus(status)) return;

  const lead = await prisma.lead.findFirst({
    where: { id, agencyId: agency.id },
    select: { id: true },
  });

  if (!lead) return;

  await prisma.lead.update({
    where: { id },
    data: { status },
    select: { id: true },
  });

  revalidatePath("/agency");
  revalidatePath("/agency/leads");
  if (listingId) revalidatePath("/agency/leads");
}

export default async function AgencyLeadsPage({
  searchParams,
}: {
  searchParams?: { status?: string; listingId?: string };
}) {
  const { agency } = await requireAgencyContext();

  const status = normalizeStatus(searchParams?.status);
  const listingId = (searchParams?.listingId ?? "").trim() || null;

  const where = {
    agencyId: agency.id,
    ...(status !== "ALL" ? { status } : {}),
    ...(listingId ? { listingId } : {}),
  } as const;

  const [leads, grouped] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            commune: true,
            price: true,
          },
        },
      },
      take: 200,
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { agencyId: agency.id, ...(listingId ? { listingId } : {}) },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<LeadStatus, number> = {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    VIEWING: 0,
    OFFER: 0,
    WON: 0,
    LOST: 0,
  };

  for (const g of grouped) {
    const s = String(g.status).toUpperCase();
    if ((STATUSES as string[]).includes(s)) counts[s as LeadStatus] = g._count._all;
  }

  const total = STATUSES.reduce((acc, s) => acc + counts[s], 0);

  const baseHref = listingId
    ? `/agency/leads?listingId=${encodeURIComponent(listingId)}`
    : "/agency/leads";
  const hrefForStatus = (s: LeadStatus | "ALL") =>
    s === "ALL"
      ? baseHref
      : `${baseHref}${baseHref.includes("?") ? "&" : "?"}status=${encodeURIComponent(
          s
        )}`;

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/40" />
        <div className="absolute -top-24 right-[-140px] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 left-[-160px] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-card shadow-sm">
                  <span className="text-lg">📨</span>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">
                    Leads
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {agency.name}
                  </p>
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Track inbound inquiries and move them through your pipeline.
                Inline updates keep your workflow fast.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Total</span>
                  <span className="tabular-nums">{total}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Showing</span>
                  <span className="tabular-nums">{leads.length}</span>
                </span>
                {listingId ? (
                  <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                    <span className="text-muted-foreground">Listing filter</span>
                    <span className="font-mono text-[11px]">{listingId}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/agency"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Dashboard
              </Link>
              <Link
                href="/agency/listings"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Listings
              </Link>
              {listingId ? (
                <Link
                  href="/agency/leads"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                  title="Clear listing filter"
                >
                  Clear filter
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
        {/* Status Tabs */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={hrefForStatus("ALL")}
              className={cx(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                status === "ALL"
                  ? "bg-primary text-primary-foreground border-primary/20"
                  : "bg-card hover:bg-accent"
              )}
            >
              All <span className="ml-2 tabular-nums opacity-80">{total}</span>
            </Link>

            {STATUSES.map((s) => (
              <Link
                key={s}
                href={hrefForStatus(s)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  status === s
                    ? "bg-primary text-primary-foreground border-primary/20"
                    : "bg-card hover:bg-accent"
                )}
                title={`Filter: ${s}`}
              >
                {s} <span className="ml-2 tabular-nums opacity-80">{counts[s]}</span>
              </Link>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Tip: Use{" "}
            <span className="font-medium text-foreground">Quick actions</span>{" "}
            to move leads fast, then refine later.
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-4 font-medium text-muted-foreground">Date</th>
                  <th className="p-4 font-medium text-muted-foreground">Lead</th>
                  <th className="p-4 font-medium text-muted-foreground">Listing</th>
                  <th className="p-4 font-medium text-muted-foreground">Status</th>
                  <th className="p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {leads.map((l) => {
                  const st = String(l.status).toUpperCase() as LeadStatus;
                  const listingTitle = l.listing?.title ?? "—";
                  const listingMeta = [
                    l.listing?.commune ? l.listing.commune : "",
                    l.listing?.price != null ? formatEUR(l.listing.price) : "",
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  const messagePreview = (l.message ?? "").trim();
                  const hasMessage = messagePreview.length > 0;

                  return (
                    <tr key={l.id} className="hover:bg-accent/40">
                      <td className="p-4 align-top whitespace-nowrap">
                        <div className="font-medium">{formatDate(l.createdAt)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Lead ID:{" "}
                          <span className="font-mono">{l.id.slice(0, 10)}…</span>
                        </div>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-semibold text-foreground">{l.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <a
                            className="underline underline-offset-4"
                            href={`mailto:${l.email}`}
                          >
                            {l.email}
                          </a>
                          {l.phone ? (
                            <>
                              <span className="mx-2 text-muted-foreground/40">
                                •
                              </span>
                              <a
                                className="underline underline-offset-4"
                                href={`tel:${l.phone}`}
                              >
                                {l.phone}
                              </a>
                            </>
                          ) : null}
                        </div>

                        {hasMessage ? (
                          <div className="mt-2 line-clamp-2 max-w-xl text-sm text-foreground/90">
                            “{messagePreview}”
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-muted-foreground">
                            No message.
                          </div>
                        )}
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-medium">{listingTitle}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {listingMeta}
                        </div>

                        {l.listing?.id ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Link
                              href={`/listing/${l.listing.id}`}
                              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                            >
                              View public
                            </Link>
                            <Link
                              href={`/agency/listings/${l.listing.id}/edit`}
                              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95"
                            >
                              Open listing
                            </Link>
                            <Link
                              href={`/agency/leads?listingId=${l.listing.id}`}
                              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                              title="Filter leads for this listing"
                            >
                              Filter leads
                            </Link>
                          </div>
                        ) : null}
                      </td>

                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-2">
                          <span
                            className={cx(
                              "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium",
                              statusPillClass(st)
                            )}
                          >
                            {st}
                          </span>

                          {/* Inline update (auto-submit via client component) */}
                          <form action={updateLeadStatus} className="flex flex-col gap-2">
                            <input type="hidden" name="id" value={l.id} />
                            <input
                              type="hidden"
                              name="listingId"
                              value={l.listingId ?? ""}
                            />

                            <AutoSubmitSelect
                              name="status"
                              defaultValue={st}
                              className="w-full rounded-xl border bg-card px-3 py-2 text-xs font-medium"
                              aria-label="Update status"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </AutoSubmitSelect>
                          </form>

                          {/* Quick actions */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <form action={setLeadStatusQuick}>
                              <input type="hidden" name="id" value={l.id} />
                              <input
                                type="hidden"
                                name="listingId"
                                value={l.listingId ?? ""}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="CONTACTED"
                              />
                              <button
                                type="submit"
                                className="rounded-xl border bg-card px-3 py-1.5 text-[11px] font-medium hover:bg-accent"
                              >
                                Mark contacted
                              </button>
                            </form>

                            <form action={setLeadStatusQuick}>
                              <input type="hidden" name="id" value={l.id} />
                              <input
                                type="hidden"
                                name="listingId"
                                value={l.listingId ?? ""}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="QUALIFIED"
                              />
                              <button
                                type="submit"
                                className="rounded-xl border bg-card px-3 py-1.5 text-[11px] font-medium hover:bg-accent"
                              >
                                Qualified
                              </button>
                            </form>

                            <form action={setLeadStatusQuick}>
                              <input type="hidden" name="id" value={l.id} />
                              <input
                                type="hidden"
                                name="listingId"
                                value={l.listingId ?? ""}
                              />
                              <input type="hidden" name="status" value="LOST" />
                              <button
                                type="submit"
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-900 hover:bg-rose-100"
                              >
                                Lost
                              </button>
                            </form>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`mailto:${l.email}`}
                            className="rounded-xl border bg-card px-3 py-2 text-xs font-medium hover:bg-accent"
                            title="Email lead"
                          >
                            ✉️ Email
                          </a>

                          {l.phone ? (
                            <a
                              href={`tel:${l.phone}`}
                              className="rounded-xl border bg-card px-3 py-2 text-xs font-medium hover:bg-accent"
                              title="Call lead"
                            >
                              📞 Call
                            </a>
                          ) : null}

                          {l.listingId ? (
                            <Link
                              href={`/agency/leads?listingId=${l.listingId}`}
                              className="rounded-xl border bg-card px-3 py-2 text-xs font-medium hover:bg-accent"
                              title="Filter by listing"
                            >
                              Listing leads
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No listing linked
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">
                          Workflow: Contact → Qualify → Viewing → Offer → Won/Lost
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {leads.length === 0 ? (
                  <tr>
                    <td
                      className="p-8 text-center text-sm text-muted-foreground"
                      colSpan={5}
                    >
                      No leads yet for this agency.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium text-foreground">
                Next best UX upgrade
              </div>
              <div className="mt-1">
                Convert this to a client “Lead Inbox” with{" "}
                <span className="font-medium text-foreground">
                  optimistic inline updates
                </span>
                , row-level loading, and rollback toast.
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/agency"
                className="rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Back to dashboard
              </Link>
              <Link
                href="/agency/listings"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
              >
                Manage listings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
