import { SignIn } from "@clerk/nextjs";
import { authDestination } from "@/lib/team-validation";
export const metadata = { title: "Sign in" };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const destination = authDestination((await searchParams).redirect_url, process.env.APP_ORIGIN);
  return <div className="flex justify-center"><SignIn routing="path" path="/sign-in" signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(destination)}`} forceRedirectUrl={destination} signUpForceRedirectUrl={destination} /></div>;
}
