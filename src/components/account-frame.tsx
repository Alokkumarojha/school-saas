"use client";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

// Organization routes provide their own verified shell; account pages keep theirs.
export function AccountFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/app/org/")) return <>{children}</>;
  return (
    <>
      <div className="min-h-dvh">
        <header className="border-b border-border bg-card px-4 py-4">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <Link href="/app" className="text-xl font-bold text-primary">
              Vidya
            </Link>
            <nav
              aria-label="Account navigation"
              className="flex items-center gap-3"
            >
              <Link
                href="/app"
                className="flex min-h-11 items-center text-sm font-semibold"
              >
                Organizations
              </Link>
              <ThemeToggle />
              <UserButton />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </>
  );
}

