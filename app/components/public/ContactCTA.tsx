// app/components/public/ContactCTA.tsx
"use client";

import { useState } from "react";
import { Calendar, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import ContactDrawer from "@/app/components/public/ContactDrawer";

type Intent = "VIEWING" | "QUESTION" | "OFFER";

export default function ContactCTA({
  listingId,
  listingTitle,
  commune,
  priceLabel,
}: {
  listingId: string;
  listingTitle: string;
  commune?: string | null;
  priceLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>("VIEWING");

  function openWith(i: Intent) {
    setIntent(i);
    setOpen(true);
  }

  return (
    <>
      <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
        <div className="text-sm text-muted-foreground">Interested in this home?</div>
        <div className="mt-1 text-2xl font-semibold">{priceLabel ?? "Contact for price"}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {commune ? `${commune} • ` : ""}Secure enquiry — no spam
        </div>

        <div className="mt-4 grid gap-2">
          <Button type="button" className="w-full" onClick={() => openWith("VIEWING")}>
            <Calendar className="mr-2 h-4 w-4" />
            Request viewing
          </Button>

          <Button type="button" variant="outline" className="w-full" onClick={() => openWith("QUESTION")}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Ask a question
          </Button>
        </div>
      </div>

      <ContactDrawer
        open={open}
        onOpenChange={setOpen}
        listingId={listingId}
        listingTitle={listingTitle}
        commune={commune}
        initialIntent={intent}
      />
    </>
  );
}