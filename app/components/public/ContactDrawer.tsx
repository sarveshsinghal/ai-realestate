// app/components/public/ContactDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Phone, UserRound, Sparkles, X, CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Toast from "@/app/components/public/Toast";

type Intent = "VIEWING" | "QUESTION" | "OFFER";

function intentLabel(intent: Intent) {
  if (intent === "VIEWING") return "Request a viewing";
  if (intent === "OFFER") return "Make an offer";
  return "Ask a question";
}

function buildDefaultMessage(intent: Intent, listingTitle: string, commune?: string | null) {
  const loc = commune ? ` in ${commune}` : "";
  if (intent === "VIEWING") {
    return `Hi, I’m interested in scheduling a viewing for “${listingTitle}”${loc}.\n\nThanks!`;
  }
  if (intent === "OFFER") {
    return `Hi, I’m interested in making an offer for “${listingTitle}”${loc}. My offer is: …\n\nPlease contact me to discuss next steps.`;
  }
  return `Hi, I have a question about “${listingTitle}”${loc}: …`;
}

async function readApiError(res: Response) {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
    return JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return "Request failed.";
    }
  }
}

function formatDateTimeLocalToHuman(dtLocal: string) {
  if (!dtLocal) return "";
  try {
    const d = new Date(dtLocal);
    if (Number.isNaN(d.getTime())) return dtLocal;
    return d.toLocaleString("de-LU", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dtLocal;
  }
}

export default function ContactDrawer({
  open,
  onOpenChange,
  listingId,
  listingTitle,
  commune,
  initialIntent = "VIEWING",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listingId: string;
  listingTitle: string;
  commune?: string | null;
  initialIntent?: Intent;
}) {
  const [intent, setIntent] = useState<Intent>(initialIntent);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Viewing extras
  const [preferredDateTime, setPreferredDateTime] = useState<string>("");
  const [availabilityNotes, setAvailabilityNotes] = useState<string>("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // toast
  const [toastOpen, setToastOpen] = useState(false);

  // When opening: sync intent + prefill message (min length requirement)
  useEffect(() => {
    if (!open) return;

    setIntent(initialIntent);
    setDone(false);
    setErr(null);
    setLoading(false);

    setMessage((prev) => {
      const trimmed = prev.trim();
      if (trimmed.length >= 10) return prev;
      return buildDefaultMessage(initialIntent, listingTitle, commune);
    });

    setPreferredDateTime("");
    setAvailabilityNotes("");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIntent, listingTitle, commune]);

  const defaultMsg = useMemo(
    () => buildDefaultMessage(intent, listingTitle, commune),
    [intent, listingTitle, commune]
  );

  function close() {
    onOpenChange(false);
    setErr(null);
    setLoading(false);
    setDone(false);
  }

  function switchIntent(next: Intent) {
    setIntent(next);
    setDone(false);
    setErr(null);

    setMessage(buildDefaultMessage(next, listingTitle, commune));

    if (next !== "VIEWING") {
      setPreferredDateTime("");
      setAvailabilityNotes("");
    }
  }

  function composeFinalMessage(): string {
    const base = (message.trim() || defaultMsg).trim();

    if (intent !== "VIEWING") return `[${intent}] ${base}`;

    const lines: string[] = [`[${intent}] ${base}`];

    const human = preferredDateTime ? formatDateTimeLocalToHuman(preferredDateTime) : "";
    if (human) lines.push("", `Preferred viewing: ${human}`);
    if (availabilityNotes.trim()) lines.push("", `Availability notes: ${availabilityNotes.trim()}`);

    return lines.join("\n");
  }

  async function submit() {
    setErr(null);

    const nm = name.trim();
    const em = email.trim();
    const ph = phone.trim();
    const finalMessage = composeFinalMessage();

    if (!listingId) return setErr("Missing listing id.");
    if (!nm || nm.length < 2) return setErr("Please enter your name.");
    if (!em || !em.includes("@")) return setErr("Please enter a valid email.");
    if (finalMessage.replace(/^\[[A-Z]+\]\s*/, "").trim().length < 10) {
      return setErr("Please write a short message (min 10 characters).");
    }

    setLoading(true);
    try {
      const payload = {
        listingId,
        name: nm,
        email: em,
        phone: ph || "",
        message: finalMessage,
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const apiErr = await readApiError(res);
        throw new Error(apiErr);
      }

      setDone(true);
      setToastOpen(true);

      // Auto close after 2s
      window.setTimeout(() => {
        onOpenChange(false);
        setDone(false);
        setErr(null);
        setLoading(false);
      }, 2000);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <Toast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        title="Request sent"
        description="Thanks! The agency will contact you soon."
      />

      {/* ✅ overlay above site header */}
      <div
        className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* ✅ drawer above site header */}
      <div
        className={cn(
          "fixed right-0 top-0 z-[110] h-[100dvh] w-full max-w-[520px] border-l bg-background shadow-2xl",
          "animate-in slide-in-from-right duration-200"
        )}
        role="dialog"
        aria-label="Contact agency drawer"
      >
        {/* header */}
        <div className="sticky top-0 z-10 border-b bg-background/80 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xl font-semibold truncate">{intentLabel(intent)}</div>
              <div className="mt-1 text-sm text-muted-foreground truncate">
                {listingTitle}
                {commune ? ` • ${commune}` : ""}
              </div>
            </div>

            <button
              onClick={close}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Close"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* intent toggles */}
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={intent === "VIEWING" ? "default" : "outline"}
              onClick={() => switchIntent("VIEWING")}
            >
              Viewing
            </Button>

            <Button
              type="button"
              size="sm"
              variant={intent === "QUESTION" ? "default" : "outline"}
              onClick={() => switchIntent("QUESTION")}
            >
              Question
            </Button>
          </div>
        </div>

        {/* body */}
        <div className="h-[calc(100dvh-160px)] overflow-auto px-6 py-6">
          {done ? (
            <div className="rounded-3xl border bg-emerald-50/60 p-6">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="h-5 w-5 text-emerald-700" />
                Request sent
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Thanks! The agency will contact you soon.</p>
              <div className="mt-5 flex gap-2">
                <Button type="button" onClick={close}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="lead-name">
                  Full name
                </label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lead-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="h-11 rounded-2xl pl-9"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="lead-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lead-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="h-11 rounded-2xl pl-9"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="lead-phone">
                  Phone (optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lead-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+352 …"
                    className="h-11 rounded-2xl pl-9"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>

              {/* Viewing-only */}
              {intent === "VIEWING" ? (
                <div className="rounded-3xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarClock className="h-4 w-4 text-emerald-600" />
                    Viewing preference
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="text-sm font-medium" htmlFor="lead-dt">
                      Preferred date & time (optional)
                    </label>
                    <Input
                      id="lead-dt"
                      type="datetime-local"
                      value={preferredDateTime}
                      onChange={(e) => setPreferredDateTime(e.target.value)}
                      className="h-11 rounded-2xl"
                    />

                    <label className="mt-3 block text-sm font-medium" htmlFor="lead-notes">
                      Availability notes (optional)
                    </label>
                    <Input
                      id="lead-notes"
                      value={availabilityNotes}
                      onChange={(e) => setAvailabilityNotes(e.target.value)}
                      placeholder="e.g., weekdays after 18:00, weekends flexible"
                      className="h-11 rounded-2xl"
                    />
                    <div className="text-xs text-muted-foreground">
                      This is added to your message so the agency can schedule faster.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="lead-message">
                  Message
                </label>
                <Textarea
                  id="lead-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={defaultMsg}
                />
                <div className="text-xs text-muted-foreground">
                  Tip: include your availability or key questions.
                </div>
              </div>

              {err ? <div className="text-sm text-destructive">{err}</div> : null}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="sticky bottom-0 z-10 border-t bg-background/80 px-6 py-4 backdrop-blur">
          {!done ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Usually replies within <span className="font-medium text-foreground">24 hours</span>
              </div>
              <Button type="button" onClick={submit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send request"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}