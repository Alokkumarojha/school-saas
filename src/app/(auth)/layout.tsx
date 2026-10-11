import Link from "next/link";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
export const dynamic = "force-dynamic";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider><main className="mx-auto min-h-dvh max-w-xl px-4 py-8"><header className="mb-10 flex items-center justify-between"><Link href="/" className="text-xl font-bold text-primary">Vidya</Link><ThemeToggle /></header>{children}<p className="mt-6 text-center text-sm text-muted-foreground"><Link href="/">Back to sample UI</Link></p></main></AuthProvider>;
}
