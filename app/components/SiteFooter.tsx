// app/components/SiteFooter.tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t bg-background/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="text-sm font-semibold">EstateIQ</div>
            <p className="text-sm text-muted-foreground">
              A premium marketplace + agency portal for modern real estate workflows.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="font-semibold">Explore</div>
            <div className="grid gap-1 text-muted-foreground">
              <Link className="hover:text-foreground" href="/listings">
                Listings
              </Link>
              <Link className="hover:text-foreground" href="/agency">
                Agency portal
              </Link>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="font-semibold">Company</div>
            <div className="grid gap-1 text-muted-foreground">
              <span>About</span>
              <span>Careers</span>
              <span>Press</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="font-semibold">Legal</div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} EstateIQ. All rights reserved.</span>
          <span>Made with Next.js • Tailwind • shadcn/ui</span>
        </div>
      </div>
    </footer>
  );
}