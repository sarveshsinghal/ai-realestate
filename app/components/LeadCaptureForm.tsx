// app/components/LeadCaptureForm.tsx
"use client";

import { useState } from "react";

export function LeadCaptureForm({
  listingId,
  agencyName,
}: {
  listingId: string;
  agencyName?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hi, I’m interested. Could we schedule a viewing?");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, name, email, phone, message }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("Hi, I’m interested. Could we schedule a viewing?");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border rounded-md p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">Request a viewing</h2>
        <p className="text-sm text-muted-foreground">
          Contact {agencyName ?? "the agency"} about this property.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm">Name</label>
          <input
            className="w-full border rounded-md px-3 py-2 bg-transparent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Email</label>
          <input
            className="w-full border rounded-md px-3 py-2 bg-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Phone (optional)</label>
          <input
            className="w-full border rounded-md px-3 py-2 bg-transparent"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+352 ..."
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm">Message</label>
          <textarea
            className="w-full border rounded-md px-3 py-2 bg-transparent min-h-[110px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md border font-medium hover:bg-muted disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send inquiry"}
          </button>

          {success && (
            <span className="text-sm text-green-600">
              Sent! The agency will contact you soon.
            </span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </section>
  );
}
