import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>No account needed — your progress is tied to this browser.</p>
        <div className="flex flex-col gap-1 sm:items-end">
          <Link href="/upgrade?demo=1" className="link font-medium text-ink-soft">
            Demo: unlock paid
          </Link>
          <span className="text-xs">Stripe test mode — card 4242 4242 4242 4242, any future date, any CVC.</span>
        </div>
      </div>
    </footer>
  );
}
