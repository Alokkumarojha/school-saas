import { ThemeToggle } from "@/components/theme-toggle";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Team invitation", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

// No Clerk client/provider, analytics, external avatars or third-party resources
// on the fragment landing or acceptance pages. Identity is checked server-side.
export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-xl px-4 py-8">
    {/* A document navigation is required when leaving the landing CSP. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <header className="mb-8 flex items-center justify-between gap-3"><a className="text-xl font-bold" href="/" referrerPolicy="no-referrer">Vidya</a><ThemeToggle /></header>
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">{children}</div>
  </main>;
}
