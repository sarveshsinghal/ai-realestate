import { LISTINGS } from "@/lib/mockData";
import { dealScore } from "@/lib/scoring";

export default function AgencyDashboard() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">

      <h1 className="text-2xl font-semibold">Agency Intelligence Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Total Listings</p>
          <p className="text-xl font-semibold">{LISTINGS.length}</p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Avg Deal Score</p>
          <p className="text-xl font-semibold">
            {Math.round(
              LISTINGS.reduce((acc, l) => acc + dealScore(l).score, 0) /
                LISTINGS.length
            )}
            /100
          </p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Strong Deals (A)</p>
          <p className="text-xl font-semibold">
            {
              LISTINGS.filter((l) => dealScore(l).grade === "A")
                .length
            }
          </p>
        </div>

      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Your Listings</h2>

        <div className="border rounded-md divide-y">
          {LISTINGS.map((l) => {
            const s = dealScore(l);
            return (
              <div key={l.id} className="p-4 flex justify-between">
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.commune}
                  </p>
                </div>
                <div className="text-right">
                  <p>Score: {s.score}/100</p>
                  <p className="text-sm text-muted-foreground">
                    Grade {s.grade}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </main>
  );
}
