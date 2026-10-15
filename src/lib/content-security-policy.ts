// Shared by next.config and regression tests. No request Host or browser input
// is used to build either policy. Keep CSP emission in next.config only.
export function invitationLandingPolicy(development: boolean) {
  return `default-src 'self'; script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
}

export function clerkPagePolicy({ publishableKey, development }: {
  publishableKey?: string; development: boolean;
}) {
  // Clerk publishable keys encode the instance's Frontend API hostname followed
  // by '$'. Decode only public configuration, not CLERK_SECRET_KEY.
  let frontendOrigin = "";
  if (publishableKey) {
    if (!/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(publishableKey)) throw new Error("Invalid Clerk publishable key for CSP configuration.");
    const host = Buffer.from(publishableKey.replace(/^pk_(test|live)_/, ""), "base64").toString("utf8");
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+\$$/i.test(host)) throw new Error("Invalid Clerk Frontend API hostname for CSP configuration.");
    frontendOrigin = `https://${host.slice(0, -1).toLowerCase()}`;
  }
  // Narrow vendor sources required by Clerk's official CSP guidance. Protection
  // connections use non-443 ports; never replace these with '*' or 'https:'.
  const protection = "https://*.protect.clerk.com";
  const sources = (...values: string[]) => values.filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src ${sources("'self'", "'unsafe-inline'", development ? "'unsafe-eval'" : "", frontendOrigin, "https://challenges.cloudflare.com", protection)}`,
    `connect-src ${sources("'self'", frontendOrigin, "https://img.clerk.com", "https://clerk-telemetry.com", "https://*.clerk-telemetry.com", `${protection}:*`)}`,
    "img-src 'self' data: https://img.clerk.com",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    `frame-src ${sources("'self'", "https://challenges.cloudflare.com", protection)}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
}
