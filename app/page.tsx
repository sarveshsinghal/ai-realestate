"use client";

import { useState } from "react";

type FormState = {
  language: "EN" | "FR" | "DE";
  propertyType: string;
  location: string;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  condition: string;
  price: string;
  features: string;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
    language: "EN",
    propertyType: "Apartment",
    location: "Luxembourg City (Gare)",
    sizeSqm: 72,
    bedrooms: 2,
    bathrooms: 1,
    condition: "Renovated",
    price: "€695,000",
    features:
      "Balcony, indoor parking, cellar, close to tram, bright living room, elevator",
  });

  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult("");
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ? String(data.error) : "Request failed");
      } else {
        setResult(data?.result ?? "No result returned");
      }
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">
          AI Real Estate Description Generator
        </h1>
        <p className="text-gray-600">
          Generate Luxembourg-style property listings in seconds (EN/FR/DE).
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-700">Language</label>
            <select
              className="border p-2 rounded w-full"
              value={form.language}
              onChange={(e) => update("language", e.target.value as FormState["language"])}
            >
              <option value="EN">English</option>
              <option value="FR">French</option>
              <option value="DE">German</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-700">Property type</label>
            <input
              className="border p-2 rounded w-full"
              value={form.propertyType}
              onChange={(e) => update("propertyType", e.target.value)}
              placeholder="Apartment / House / Studio"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-gray-700">Location</label>
            <input
              className="border p-2 rounded w-full"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Luxembourg City (Kirchberg), Esch-sur-Alzette..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-700">Living area (sqm)</label>
            <input
              className="border p-2 rounded w-full"
              type="number"
              value={form.sizeSqm}
              onChange={(e) => update("sizeSqm", Number(e.target.value))}
              min={10}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-700">Condition</label>
            <input
              className="border p-2 rounded w-full"
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              placeholder="New / Renovated / To renovate"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-700">Bedrooms</label>
            <input
              className="border p-2 rounded w-full"
              type="number"
              value={form.bedrooms}
              onChange={(e) => update("bedrooms", Number(e.target.value))}
              min={0}
              max={20}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-700">Bathrooms</label>
            <input
              className="border p-2 rounded w-full"
              type="number"
              value={form.bathrooms}
              onChange={(e) => update("bathrooms", Number(e.target.value))}
              min={0}
              max={20}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-gray-700">Price</label>
            <input
              className="border p-2 rounded w-full"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder="€695,000"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-gray-700">Features</label>
            <textarea
              className="border p-2 rounded w-full"
              rows={3}
              value={form.features}
              onChange={(e) => update("features", e.target.value)}
              placeholder="Balcony, parking, cellar, elevator, near tram..."
            />
          </div>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "Generating..." : "Generate listing"}
        </button>
      </form>

      {error && (
        <div className="mt-6 border border-red-300 bg-red-50 text-red-800 p-4 rounded whitespace-pre-wrap">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 border rounded p-4 whitespace-pre-wrap">
          {result}
        </div>
      )}

      <footer className="mt-10 text-xs text-gray-500">
        Note: Generated text is for marketing assistance only. Verify details before publishing.
      </footer>
    </main>
  );
}
