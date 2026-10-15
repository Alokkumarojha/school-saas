# React script warning: organization unavailable

Investigated 2026-10-15. No runtime fix is justified by the available evidence.

## Evidence and limitations

The exact warning comes from the development React DOM renderer bundled with Next.js, in `node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js`, when creating an executable script during client rendering. It is not a CSP violation message. The emitter does not establish which component supplied the script.

The organization layout checks current membership before constructing its shell. Missing membership invokes `notFound()`. The application not-found/error components have no scripts and expose no organization details. Clerk wraps the account layout, outside the organization layout; the theme provider wraps the root layout. No application-authored script tags were found in these paths.

Installed Clerk generates an external asynchronous bootstrap; next-themes generates an inline theme bootstrap. React treats eligible asynchronous external scripts as hoistable resources. A focused test confirms the real theme provider emits an inline script in server-rendered markup. Neither observation identifies the script responsible for the reported client warning. At the initial investigation no component stack was available. The follow-up below records the new stack and narrows the script path; the removed-member trigger remains unreproduced.

Recent invitation/CSP changes keep the private policy scoped to `/join`, with a compatible policy on Clerk-dependent routes. Invitation preparation strips the token and establishes the secure session before full-document navigation to acceptance; the join exit link also performs document navigation. These paths are separate from the organization fallback. No evidence connects this React warning to conflicting CSP headers or invitation navigation. No runtime, CSP, provider, authorization, dependency, or navigation changes were made for this investigation.

## Verification

- Four added tests use mocked identity/database calls with the actual organization layout and fallbacks. They cover revoked membership, unauthenticated denial before queries, generic/script-free fallback markup, and separate theme bootstrap SSR output.
- TypeScript and ESLint passed.
- All 387 tests passed across 20 files. These do not verify real database behavior or client hydration.
- Git diff whitespace check passed, with existing LF/CRLF conversion notices only.
- Browser: an ordinary unmatched localhost route rendered the public shell and 404 without console errors/warnings. This does not exercise the signed-in removed-member route.
- No authenticated removed-member browser session was available; no live memberships or data were changed. The original warning is not claimed reproduced or fixed.

## Pending manual checks

Using an already removed member in a test environment, directly load and refresh the organization route. Confirm Workspace unavailable and no private organization data. Compare full reload with client navigation. If the warning recurs, capture its expanded component stack and whether it occurs during hydration, navigation, or development hot reload; omit tokens, cookies, and account details. Confirm authorized access and theme/account controls still work. The supplied stack is analyzed below; runtime evidence is still needed before changing behavior.

## Follow-up: supplied component stack

The user subsequently supplied `<J> -> ThemeProvider @ theme-provider.tsx:5 -> layout.tsx:26`. Inspection of the installed next-themes 0.4.6 ESM bundle establishes this mapping: `export { J as ThemeProvider }`; J returns children when a theme context already exists, otherwise renders V. V renders the context provider, the memoized `_` theme script component, and children. `_` emits the inline executable script. Thus J is the library provider, not literally the script component. The stack plus this actual render path supports attribution to the next-themes bootstrap path, rather than Clerk; it does not explain why React needed to create that script on the client.

The root layout contains a single unconditional, unkeyed theme provider around AppShell. There are no additional HTML/body roots or theme providers in the inspected application. The organization layout checks membership and throws notFound below this root. The installed Next HTTP-access fallback boundary replaces its children with metadata and fallback markup; it does not itself render a theme provider or script. No application-controlled remount was identified. Normal layout preservation does not prove that hydration recovery or development rendering could not remount a subtree. No runtime tracing of the removed-member case is available, so remounting/document-transition causality remains unverified.

Added bootstrap execution tests against the actual server-emitted script using an isolated Node VM and mocked DOM/storage/media-query surfaces. They check stored light/dark preference and system defaults before effects/hydration; these are not browser hydration or flash measurements. No runtime change, mounted-only gate, warning suppression, or dependency upgrade is warranted from the available evidence.


Follow-up browser check: navigation from the public unmatched route to `/app` reached Clerk sign-in, confirming this browser is signed out. Only Clerk's development-key notice was logged; the reported script warning was not observed. No removed-member session was available, so authenticated refresh/navigation, provider remount timing, and browser flash/hydration behavior in that case remain pending.

Follow-up checks: TypeScript passed; all 392 tests passed across 20 files (including five added bootstrap cases). Git diff whitespace check passed with existing line-ending notices only.
ESLint also completed successfully (exit code 0).
