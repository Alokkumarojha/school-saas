import type { NextConfig } from "next";
import { clerkPagePolicy, invitationLandingPolicy } from "./src/lib/content-security-policy";

const nextConfig: NextConfig = {
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    const clerkHeaders = [...privateHeaders, { key: "Content-Security-Policy", value: clerkPagePolicy({
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      development: process.env.NODE_ENV === "development",
    }) }];
    return [
      { source: "/join", headers: [...privateHeaders,
        // The raw token arrives only as a fragment on /join. No third-party
        // client resources run there, including Clerk or analytics.
        { key: "Content-Security-Policy", value: invitationLandingPolicy(process.env.NODE_ENV === "development") },
      ] },
      // Acceptance has no raw URL token. It shares the Clerk policy with its
      // client-side redirect destinations; do not overlap the landing rule.
      { source: "/join/accept/:path*", headers: clerkHeaders },
      { source: "/app/:path*", headers: clerkHeaders },
      { source: "/sign-in/:path*", headers: clerkHeaders },
      { source: "/sign-up/:path*", headers: clerkHeaders },
    ];
  },
};

export default nextConfig;
