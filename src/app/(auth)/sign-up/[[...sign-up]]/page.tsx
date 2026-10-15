import { SignUp } from "@clerk/nextjs";
import { authDestination } from "@/lib/team-validation";
export const metadata = { title: "Create an account" };
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const destination = authDestination((await searchParams).redirect_url, process.env.APP_ORIGIN);
  return <div className="flex justify-center"><SignUp routing="path" path="/sign-up" signInUrl={`/sign-in?redirect_url=${encodeURIComponent(destination)}`} forceRedirectUrl={destination} signInForceRedirectUrl={destination} /></div>;
}
