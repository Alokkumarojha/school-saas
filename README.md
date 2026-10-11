# Vidya — School + Coaching UI

English-language, mobile-first UI foundation built with the existing Next.js 16 App Router project, TypeScript, Tailwind CSS 4, lucide-react and next-themes. Local shadcn-compatible Button, Card and Input components are configured through `components.json`; Button uses Radix Slot and class-variance-authority.

Step 2A adds Clerk authentication and Prisma/Neon organization memberships. See [setup, authorization details, migration and manual tests](docs/step-2a.md). Configure `.env` from `.env.example` and run `npm run db:migrate` before using organization routes. Never commit real environment values.

## Run locally

```powershell
cd C:\Users\aojha\school-saas
npm install
npm run dev
```

Open http://localhost:3000 (or the port Next.js prints if that port is occupied).

```powershell
npm run typecheck
npm run lint
npm run build
npm start
```

## Screens

- `/`: dashboard, sample totals, schedule, fee overview.
- `/students`: searchable cards; batch filter; recoverable empty state.
- `/fees`: collected/outstanding totals and payment-status filters. No payment actions.
- `/attendance`: batch/date selection, present/absent controls, mark-all and reset. Changes are temporary component state, keyed by date and student ID.
- `/more`: placeholder organization details, theme preference, install guidance and preview scope.

The shell has desktop navigation and fixed mobile navigation with safe-area spacing. Its account icon links to `/app`, where signed-in users can create and pick their organizations. The demo header still names the sample institute. Theme follows the system initially; explicit light/dark selection is saved by next-themes on the device.

## API integration

`src/lib/sample-data.ts` contains typed fixtures and INR/date formatting helpers. StudentDirectory and AttendanceRegister receive records as props; replace fixture imports at route boundaries with tenant-scoped API results later. Organization access is checked against the signed-in user's database membership at each server data boundary. No student, fee, attendance, payment or subscription backend is implemented. All sample dates are fixed for reproducible preview output, not live operational data. Attendance is not persisted; do not treat it as a saved register.

## Install metadata

`src/app/manifest.ts` generates `/manifest.webmanifest`. PNG icons include 192px, 512px, a maskable 512px icon and a 180px Apple touch icon. The application uses standalone display metadata. Install availability depends on browser support and HTTPS (localhost is allowed). No service worker, offline caching or push notifications are included.

## Verification in Codex

- Prisma schema validation and client generation: passed.
- Authorization and validation unit tests: 14 passed (`npm test`).
- TypeScript: passed (`npm run typecheck`).
- ESLint: passed (`npm run lint`).
- Production build: compiled successfully, then failed with Windows `spawn EPERM` during the Next.js TypeScript phase. The worker-thread attempt encountered the same restriction; no type-check bypass is configured.
- Dev server: blocked by the same `spawn EPERM` restriction. Live UI, mobile browser, and installation checks still need verification on a machine that permits Next.js subprocesses.
- Step 2A: Neon migration and live Clerk sign-in were not run without configuration. See `docs/step-2a.md` for environment variables, migration details, dependency audit findings and the manual test plan.

The app uses system Devanagari font fallbacks, with no build-time Google Fonts request.
