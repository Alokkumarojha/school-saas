"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  House,
  UsersRound,
  Wallet,
  CalendarCheck,
  LayoutGrid,
  ChevronDown,
  Sprout,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
const navigation = [
  { href: "/", label: "Home", icon: House },
  {
    href: "/students",
    label: "Students",
    icon: UsersRound,
  },
  { href: "/fees", label: "Fees", icon: Wallet },
  {
    href: "/attendance",
    label: "Attendance",
    icon: CalendarCheck,
  },
  { href: "/more", label: "More", icon: LayoutGrid },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Account routes have their own real organization header. Demo routes retain
  // the completed mobile shell and clearly labelled sample records.
  if (
    pathname === "/join" ||
    pathname.startsWith("/join/") ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  )
    return <>{children}</>;
  function links(mobile = false) {
    return navigation.map(({ href, label, icon: Icon }) => {
      const active = pathname === href;
      return (
        <Link
          key={href}
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-xl text-sm font-semibold transition-colors",
            mobile
              ? "flex-1 flex-col justify-center gap-1 py-2 text-[11px]"
              : "px-4 py-3",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-5 shrink-0" strokeWidth={active ? 2.3 : 1.8} />
          {label}
          {!mobile && active && (
            <span className="ml-auto size-1.5 rounded-full bg-primary" />
          )}
        </Link>
      );
    });
  }
  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-2 z-50 -translate-y-24 rounded-lg bg-primary p-3 text-primary-foreground focus:translate-y-0"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card px-5 py-8 md:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
            <BookOpen className="size-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight">
            Vidya
            <span className="mt-0.5 block text-[10px] font-medium tracking-[.2em] text-muted-foreground">
              INSTITUTE MANAGER
            </span>
          </span>
        </Link>
        <p className="mb-3 mt-12 px-4 text-xs text-muted-foreground">
          Your workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-2">
          {links()}
        </nav>
        <div className="mt-auto rounded-2xl bg-muted p-4">
          <Sprout className="mb-3 size-6 text-primary" />
          <p className="text-sm font-semibold">
            Focus on learning. Simplify management.
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Your institute’s everyday work, in one place.
          </p>
        </div>
        <p className="mt-5 px-2 text-xs text-muted-foreground">
          <Link
            href="/app"
            className="mb-3 flex min-h-11 items-center font-semibold text-primary"
          >
            Your organizations / Sign in
          </Link>
          Vidya • UI preview v0.1
        </p>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden size-10 items-center justify-center rounded-xl border border-border bg-muted text-primary sm:flex">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold sm:text-base">
                  Saraswati Vidya Institute
                </p>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Kota, Rajasthan • Sample institute
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/app"
              aria-label="Your organizations or sign in"
              className="flex size-11 items-center justify-center rounded-xl border border-border text-primary"
              title="Organizations / Sign in"
            >
              <UsersRound className="size-5" />
            </Link>
            <ThemeToggle />
            <span
              className="hidden size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary sm:flex"
              aria-label="Sample owner profile"
            >
              PR
            </span>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-8 sm:pt-8 md:pb-10"
        >
          <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Demo workspace · All data is sample data
          </div>
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {links(true)}
      </nav>
    </>
  );
}
