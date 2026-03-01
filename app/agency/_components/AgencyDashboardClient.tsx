// app/agency/_components/AgencyDashboardClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Crown,
  Flame,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Target,
  Trophy,
  TriangleAlert,
  Zap,
  Timer,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "VIEWING"
  | "OFFER"
  | "WON"
  | "LOST";

type BoostLevel = "BASIC" | "PREMIUM" | "PLATINUM";

type Props = {
  agencyName: string;
  kpis: {
    totalListings: number;
    publishedCount: number;
    avgScore: number;
    strongDealsA: number;
    leadsCount: number;
    leads7d: number;
  };

  // ✅ NEW: promotions/boost system (optional but recommended)
  boosts?: {
    activeCount: number;
    expiringSoonCount: number; // e.g., ends within 3 days
  };
  boostedListings?: Array<{
    listingId: string;
    title: string | null;
    commune: string;
    level: BoostLevel;
    endsAt: string; // ISO
  }>;

  topDeals: Array<{
    id: string;
    title: string | null;
    commune: string;
    price: number | null;
    sizeSqm: number;
    bedrooms: number;
    isPublished: boolean;
    createdAt: string; // ISO
    score: number;
    grade: string;
  }>;
  needsAttention: Array<{
    id: string;
    title: string | null;
    commune: string;
    price: number | null;
    sizeSqm: number;
    bedrooms: number;
    isPublished: boolean;
    createdAt: string; // ISO
    score: number;
    grade: string;
    flags: {
      missingBasics: boolean;
      missingPrice: boolean;
      weakScore: boolean;
    };
  }>;
  recentLeads: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    message: string | null;
    status: LeadStatus;
    createdAt: string; // ISO
    listingId: string | null;
    listing: { id: string; title: string | null; commune: string } | null;
  }>;
  leadsByStatus: Array<{ status: LeadStatus; count: number }>;
  leadsTrend: Array<{ date: string; count: number }>; // yyyy-mm-dd
  scoreDistribution: Array<{ bucket: string; count: number }>;
};

function formatEUR(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(iso: string) {
  const from = new Date(iso);
  const s = Math.max(0, Math.floor((Date.now() - from.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(from);
}

function daysLeft(iso: string) {
  const end = new Date(iso).getTime();
  const diff = end - Date.now();
  const d = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return d;
}

function statusBadgeVariant(s: LeadStatus) {
  switch (s) {
    case "NEW":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "CONTACTED":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "QUALIFIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "VIEWING":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "OFFER":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "WON":
      return "border-green-200 bg-green-50 text-green-900";
    case "LOST":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-border bg-muted text-foreground";
  }
}

function scoreBadgeTone(grade: string) {
  if (grade === "A")
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (grade === "B")
    return "border-green-200 bg-green-50 text-green-900";
  if (grade === "C")
    return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-rose-200 bg-rose-50 text-rose-900";
}

function sparkColorIndex(status: LeadStatus): number {
  switch (status) {
    case "NEW":
      return 1;
    case "CONTACTED":
      return 2;
    case "QUALIFIED":
      return 3;
    case "VIEWING":
      return 4;
    case "OFFER":
      return 5;
    case "WON":
      return 2;
    case "LOST":
      return 1;
    default:
      return 3;
  }
}

function chartFill(i: number) {
  return `hsl(var(--chart-${i}))`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function boostTone(level: BoostLevel) {
  if (level === "PLATINUM")
    return "border-amber-200 bg-amber-50 text-amber-950";
  if (level === "PREMIUM")
    return "border-violet-200 bg-violet-50 text-violet-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

export default function AgencyDashboardClient(props: Props) {
  const [leadTab, setLeadTab] = useState<LeadStatus | "ALL">("ALL");

  const filteredLeads = useMemo(() => {
    if (leadTab === "ALL") return props.recentLeads;
    return props.recentLeads.filter((l) => l.status === leadTab);
  }, [leadTab, props.recentLeads]);

  const leadsByStatusNonZero = useMemo(() => {
    const base = props.leadsByStatus;
    const nonZero = base.filter((x) => x.count > 0);
    return nonZero.length > 0 ? nonZero : base;
  }, [props.leadsByStatus]);

  const boosts = props.boosts ?? { activeCount: 0, expiringSoonCount: 0 };
  const boostedListings = props.boostedListings ?? [];

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* KPI row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard
            title="Listings"
            value={props.kpis.totalListings}
            sub={`Published ${props.kpis.publishedCount}`}
            icon={<Building2 className="h-5 w-5" />}
            chip={
              props.kpis.totalListings > 0
                ? `${Math.round(
                    (props.kpis.publishedCount / props.kpis.totalListings) * 100
                  )}% live`
                : "—"
            }
          />
          <KpiCard
            title="Leads"
            value={props.kpis.leadsCount}
            sub={`${props.kpis.leads7d} in last 7 days`}
            icon={<Target className="h-5 w-5" />}
            chip={props.kpis.leads7d > 0 ? "Active" : "Quiet"}
          />
          <KpiCard
            title="Avg deal score"
            value={`${props.kpis.avgScore}/100`}
            sub="Across latest listings"
            icon={<BarChart3 className="h-5 w-5" />}
            chip={
              props.kpis.avgScore >= 75
                ? "Strong"
                : props.kpis.avgScore >= 60
                ? "OK"
                : "Needs work"
            }
          />
          <KpiCard
            title="Strong deals"
            value={props.kpis.strongDealsA}
            sub="Grade A"
            icon={<Trophy className="h-5 w-5" />}
            chip={props.kpis.strongDealsA > 0 ? "Promote these" : "Improve scoring"}
          />
        </div>

        {/* ✅ NEW: Promotions / Boosts */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Promotions</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3.5 w-3.5" />
                Boosts
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Active boosts
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {boosts.activeCount}
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Expiring soon
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {boosts.expiringSoonCount}
                  </div>
                </div>
              </div>

              {boostedListings.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border bg-card p-2 text-muted-foreground">
                      <Timer className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">No active boosts</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Boost a listing to pin it higher in Recommended (and add a
                        small lift in search ranking).
                      </div>
                      <div className="mt-3">
                        <Button asChild>
                          <Link href="/agency/listings">Boost a listing</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {boostedListings.slice(0, 4).map((b) => {
                    const dLeft = daysLeft(b.endsAt);
                    const soon = dLeft <= 3;
                    return (
                      <div
                        key={b.listingId}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {b.title ?? "(Untitled)"}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {b.commune}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                boostTone(b.level)
                              )}
                            >
                              {b.level}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                soon
                                  ? "border-amber-200 bg-amber-50 text-amber-950"
                                  : "border-neutral-200 bg-neutral-50 text-neutral-800"
                              )}
                            >
                              Ends in {dLeft <= 0 ? "0" : dLeft}d
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/agency/listings/${b.listingId}/edit`}>
                              Manage
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-1">
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/agency/listings">View all boosts</Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Leads by status</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                14d
              </Badge>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ReTooltip />
                  <Pie
                    data={leadsByStatusNonZero}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {leadsByStatusNonZero.map((x) => (
                      <Cell key={x.status} fill={chartFill(sparkColorIndex(x.status))} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Lead flow</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3.5 w-3.5" />
                14d trend
              </Badge>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={props.leadsTrend}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ReTooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={chartFill(2)}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Deals + Score distribution */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Top deals</CardTitle>
              <Link
                href="/agency/listings"
                className="text-sm underline underline-offset-4"
              >
                Manage <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {props.topDeals.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="No listings yet"
                  subtitle="Create your first listing to start scoring and tracking performance."
                  action={
                    <Button asChild>
                      <Link href="/agency/listings/new">New listing</Link>
                    </Button>
                  }
                />
              ) : (
                props.topDeals.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold">
                          {l.title ?? "(Untitled)"}
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-semibold",
                            scoreBadgeTone(l.grade)
                          )}
                        >
                          {l.grade}
                        </span>
                        <Badge variant={l.isPublished ? "default" : "secondary"}>
                          {l.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> {l.commune}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="inline-flex items-center gap-1">
                          <CircleDollarSign className="h-4 w-4" /> {formatEUR(l.price)}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>{l.bedrooms} bd</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>{l.sizeSqm} m²</span>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                        {timeAgo(l.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Crown className="h-3.5 w-3.5" />
                        {l.score}/100
                      </Badge>
                      <Button variant="secondary" asChild>
                        <Link href={`/agency/listings/${l.id}/edit`}>Edit</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/listing/${l.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Score distribution</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <BadgeCheck className="h-3.5 w-3.5" />
                latest
              </Badge>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={props.scoreDistribution}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ReTooltip />
                  <Bar dataKey="count">
                    {props.scoreDistribution.map((x, idx) => (
                      <Cell
                        key={x.bucket}
                        fill={chartFill(((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Attention + leads */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Needs attention</CardTitle>
              <Link
                href="/agency/listings"
                className="text-sm underline underline-offset-4"
              >
                Fix <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {props.needsAttention.length === 0 ? (
                <EmptyState
                  icon={<BadgeCheck className="h-5 w-5" />}
                  title="All clear"
                  subtitle="Nothing urgent right now."
                />
              ) : (
                props.needsAttention.map((l) => (
                  <div key={l.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold">
                            {l.title ?? "(Untitled)"}
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs font-semibold",
                              scoreBadgeTone(l.grade)
                            )}
                          >
                            {l.grade}
                          </span>
                          <Badge variant={l.isPublished ? "default" : "secondary"}>
                            {l.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </div>

                        <div className="mt-1 text-sm text-muted-foreground">
                          {l.commune} • {formatEUR(l.price)} • {l.bedrooms} bd •{" "}
                          {l.sizeSqm} m²
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {l.flags.missingBasics ? (
                            <Badge variant="destructive" className="gap-1">
                              <TriangleAlert className="h-3.5 w-3.5" />
                              Missing required fields
                            </Badge>
                          ) : null}
                          {l.flags.missingPrice ? (
                            <Badge variant="secondary">Price missing</Badge>
                          ) : null}
                          {l.flags.weakScore ? (
                            <Badge variant="outline">Score below 60</Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <Badge variant="outline" className="tabular-nums">
                          {l.score}/100
                        </Badge>
                        <div className="mt-2">
                          <Button size="sm" asChild>
                            <Link href={`/agency/listings/${l.id}/edit`}>Edit</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent leads</CardTitle>
              <Link
                href="/agency/leads"
                className="text-sm underline underline-offset-4"
              >
                View all <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </Link>
            </CardHeader>

            <CardContent>
              <Tabs
                value={leadTab}
                onValueChange={(v) => setLeadTab(v as any)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="NEW">New</TabsTrigger>
                  <TabsTrigger value="VIEWING">Viewing</TabsTrigger>
                  <TabsTrigger value="OFFER">Offer</TabsTrigger>
                </TabsList>

                <Separator className="my-4" />

                <TabsContent value={leadTab} className="mt-0 space-y-3">
                  {filteredLeads.length === 0 ? (
                    <EmptyState
                      icon={<Target className="h-5 w-5" />}
                      title="No leads in this filter"
                      subtitle="Switch tabs or check the Leads page."
                      action={
                        <Button variant="secondary" asChild>
                          <Link href="/agency/leads">Open leads</Link>
                        </Button>
                      }
                    />
                  ) : (
                    filteredLeads.map((l) => (
                      <div key={l.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold">
                                {l.name}
                              </div>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-xs font-medium",
                                  statusBadgeVariant(l.status)
                                )}
                              >
                                {l.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {timeAgo(l.createdAt)}
                              </span>
                            </div>

                            <div className="mt-1 text-sm text-muted-foreground">
                              {l.listing?.title ? (
                                <>
                                  <span className="font-medium text-foreground">
                                    {l.listing.title}
                                  </span>
                                  {l.listing.commune ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      • {l.listing.commune}
                                    </span>
                                  ) : null}
                                </>
                              ) : l.listingId ? (
                                <span className="text-muted-foreground">
                                  Listing linked
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Unassigned listing
                                </span>
                              )}
                            </div>

                            {l.message ? (
                              <div className="mt-2 line-clamp-2 text-sm text-foreground/90">
                                “{l.message}”
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={async () => {
                                      await copyToClipboard(l.email);
                                    }}
                                  >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Email
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Copy email to clipboard
                                </TooltipContent>
                              </Tooltip>

                              {l.phone ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        await copyToClipboard(l.phone ?? "");
                                      }}
                                    >
                                      <Phone className="mr-2 h-4 w-4" />
                                      Phone
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Copy phone to clipboard
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}

                              <Button size="sm" asChild>
                                <Link href="/agency/leads">Open leads</Link>
                              </Button>

                              {l.listingId ? (
                                <Button size="sm" variant="outline" asChild>
                                  <Link
                                    href={`/agency/listings/${l.listingId}/edit`}
                                  >
                                    Open listing
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <Badge variant="outline" className="shrink-0">
                            {l.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>

              <p className="mt-4 text-xs text-muted-foreground">
                Tip: Lead status colors match your enum: NEW → LOST.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

function KpiCard(props: {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ReactNode;
  chip: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {props.title}
        </CardTitle>
        <div className="rounded-xl border bg-card p-2 text-muted-foreground">
          {props.icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{props.value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{props.sub}</div>
        <div className="mt-3">
          <Badge variant="secondary" className="tabular-nums">
            {props.chip}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState(props: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/40 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border bg-card p-2 text-muted-foreground">
          {props.icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{props.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{props.subtitle}</div>
          {props.action ? <div className="mt-4">{props.action}</div> : null}
        </div>
      </div>
    </div>
  );
}