"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { BookOpen, House, UsersRound, Layers, Wallet, CalendarCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function OrganizationShell({ organization, children }: {
  organization: { id: string; name: string; type: "SCHOOL" | "COACHING" };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const basePath = `/app/org/${organization.id}`;
  const navigation = [
    { href: basePath, label: "Workspace", icon: House },
    { href: `${basePath}/students`, label: "Students", icon: UsersRound },
    { href: `${basePath}/fees`, label: "Fees", icon: Wallet },
    { href: `${basePath}/groups`, label: organization.type === "SCHOOL" ? "Classes" : "Batches", icon: Layers },
    { href: `${basePath}/attendance`, label: "Attendance", icon: CalendarCheck },
  ];
  function links(mobile = false) {
    return navigation.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || (href !== basePath && pathname.startsWith(`${href}/`));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={cn("flex min-h-12 min-w-0 items-center gap-3 rounded-xl text-sm font-semibold transition-colors",
          mobile ? "flex-1 flex-col justify-center gap-1 py-2 text-[11px] sm:text-xs" : "px-4 py-3",
          active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
        <Icon aria-hidden="true" className="size-5 shrink-0" />{label}
      </Link>;
    });
  }
  return <div className="min-h-dvh min-w-0">
    <a href="#organization-main" className="fixed left-4 top-2 z-50 -translate-y-24 rounded-lg bg-primary p-3 text-primary-foreground focus:translate-y-0">Skip to main content</a>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto border-r border-border bg-card px-5 py-8 md:flex">
      <Link href={basePath} className="flex min-h-12 items-center gap-3 px-2 text-2xl font-bold tracking-tight"><span className="rounded-xl bg-primary p-2.5 text-primary-foreground"><BookOpen aria-hidden="true" className="size-6" /></span>Vidya</Link>
      <p className="mb-3 mt-12 px-4 text-xs text-muted-foreground">Your workspace</p>
      <nav aria-label="Organization navigation" className="space-y-2">{links()}</nav>
    </aside>
    <div className="min-w-0 md:pl-60">
      <header className="border-b border-border bg-card px-4 py-2 sm:px-8">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="[overflow-wrap:anywhere] text-sm font-bold leading-snug sm:text-base">{organization.name}</p>
            <div className="flex flex-wrap items-center gap-x-3"><p className="text-xs text-muted-foreground">{organization.type === "SCHOOL" ? "School" : "Coaching"}</p>
            <Link href="/app" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-4 hover:underline">Switch organization</Link></div>
          </div>
          <div role="group" aria-label="Account and appearance controls" className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <UserButton appearance={{ elements: { userButtonTrigger: "min-h-11 min-w-11 justify-center" } }} />
          </div>
        </div>
      </header>
      <main id="organization-main" className="mx-auto min-w-0 max-w-7xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 md:py-8">{children}</main>
    </div>
    <nav aria-label="Mobile organization navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">{links(true)}</nav>
  </div>;
}
