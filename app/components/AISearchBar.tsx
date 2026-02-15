"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AISearchBar() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/listings?q=${encodeURIComponent(query)}` : "/listings");
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 max-w-2xl mx-auto">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Try: "2 bedroom Kirchberg under 800k with parking"'
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
