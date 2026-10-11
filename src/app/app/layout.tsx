import { AuthProvider } from "@/components/auth-provider";
import { AccountFrame } from "@/components/account-frame";
import { requireUserId } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return <AuthProvider><AccountFrame>{children}</AccountFrame></AuthProvider>;
}
