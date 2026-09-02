# Stay.WitUS

White-label hotel websites with real-time booking, self-service content management, a
vetted concierge partner network, and guest broadcast messaging. One deployment serves
every property: a hotel is a tenant row + a domain, themed to feel like its own site.

Built for markets where mobile money is how people pay (launch rails: Paystack GHS —
MTN MoMo, Telecel, AirtelTigo, cards) with per-tenant provider selection so properties
in Stripe-supported countries use Stripe instead.

## Stack

Next.js (App Router) · Neon Postgres + Drizzle · Better Auth (product-local, plus
optional "Sign in with WitUS" on the platform host) · Tailwind v4 · Mailgun · Cloudinary ·
Better Stack (via the Sentry SDK) · Vitest · pnpm

## Sign in with WitUS — platform host only

Hotel guests and staff sign in with this app's own magic link, on every host, always. On the
**WitUS-branded platform host** (`stay.witus.online`) there is additionally a "Sign in with WitUS"
option backed by the ecosystem IdP at `accounts.witus.online`, with two behaviours on top:

- **"Continue as ⟨name⟩"** — the sign-in page asks the IdP whether this browser already has a WitUS
  session before making anyone type an email, and relabels the button if so. The form renders
  immediately either way; the question is asked in parallel. **A failed or blocked check is
  invisible** — Safari and Firefox block the IdP's third-party cookie and answer nothing, which is
  a supported outcome, not a bug. The name it returns is copy for a button label and **never a
  credential**: it crosses an origin boundary, so identity is established only by the OIDC flow the
  click starts.
- **Global sign-out** — "Sign out of WitUS" ends the local session *first*, then hands off to the
  IdP so every WitUS app signs out. Local-first is the safety property: if the IdP is unreachable
  or refuses, you are still signed out here.

### The white-label rule, and why it is shaped this way

**A hotel tenant's browser must never make even one request to `accounts.witus.online`.** That
single request would both reveal that a shared ecosystem exists and tell it someone visited that
hotel. So the gate (`src/lib/witus-sso.ts`) is resolved **on the server** from the request `Host`,
exact-matched against the host in `BETTER_AUTH_URL`, and it **fails closed** on every uncertainty:
unknown host, missing `Host` header, near-miss hostname, `*.vercel.app`, or a tenant lookup that
threw. A false negative costs one magic link; a false positive leaks the ecosystem.

Two subtleties worth knowing before editing that file:

- **The platform host IS a tenant row.** `scripts/seed-tenants.ts` registers `stay.witus.online`
  as a domain of the seeded platform tenant (`flags.platform`), so a tenant *does* resolve on the
  branded host. The gate therefore admits `none` **and** `platform`, and refuses `tenant`. An
  earlier version required `none` and so hid the button everywhere — silently, because "no WitUS
  button" is also what correct white-label behaviour looks like.
- **`isPlatformHost()` is not this gate.** It matches preview hosts generously, which is wrong for
  a decision the IdP exact-matches. The `trustedOrigins` wildcard in `src/lib/auth.ts` is Better
  Auth's own origin check and is also not this gate.

Belt and braces: the IdP registers **only** `https://stay.witus.online` for this client, so even a
bug here fails closed — a tenant host attempting the flow sends an unregistered `redirect_uri` and
gets a 400. That is why tenant hosts must never be added to that entry's `extraRedirectUris`.

Set `WITUS_OIDC_CLIENT_ID` / `WITUS_OIDC_CLIENT_SECRET` to switch it on; with either unset the whole
feature is dark and sign-in is magic-link only, everywhere.

## Develop

```bash
pnpm install
cp .env.example .env   # fill values (see comments); never commit .env
pnpm db:migrate        # requires DATABASE_URL; applies src/db/migrations
pnpm dev
```

Without a `DATABASE_URL`, pages render a setup notice instead of crashing — useful for
UI work. `/api/health` will report `503` in that state, because it checks the database
for real (see below).

## Uptime monitoring: `/api/health`

Point Better Stack (and any other uptime monitor) at **`/api/health`, not at `/`**. The
homepage can serve a cached `200` while the database is down, so a monitor on `/` can stay
green straight through an outage. `/api/health` runs the cheapest possible liveness query
(`select 1`) on every request, so a green check means the app is running *and* its database
answered.

| Condition | Status | Body |
|---|---|---|
| Query returned | `200` | `{"ok":true,"checks":{"db":"ok"}}` |
| Unreachable, no `DATABASE_URL`, or slower than 4s | `503` | `{"ok":false,"error":"database_unreachable"}` |

`HEAD` returns the same status with no body. Responses are `Cache-Control: no-store` and the
route is `force-dynamic` with `revalidate = 0`, so a monitor can never be answered from cache.

It is public and unauthenticated, and it is built to give away nothing:

- **Tenant-agnostic.** It never resolves a tenant from the host and never reads a tenant,
  hotel, room, booking, or guest row. `select 1` touches no table, so the answer is identical
  on every domain, and a property with no bookings still reads as up.
- **No guest data, ever.** The body is a fixed literal with no row, no count, and nothing that
  implies volume. This app holds guest names, phone numbers, addresses, and payment references.
- **No raw errors.** The failure path is a bare `catch` with no binding: the response is a fixed
  literal and the log line is a constant string, never `err.message`, because a driver error can
  carry the connection string and the log sink is as readable as the response body.
- **No third-party calls.** Paystack, Mailgun, and Cloudinary are deliberately not checked. A
  payment-vendor outage must not turn the uptime monitor red, and vendor errors carry tokens.

`src/app/api/health/route.test.ts` is the proof; keep it green. `src/middleware.ts` excludes
`/api` from the locale redirect, so the monitor is never bounced to `/en/...`.

## Error monitoring

Crashes report to **Better Stack** through the official `@sentry/nextjs` SDK (Better Stack
exposes a Sentry-compatible ingest endpoint). Every init is guarded on a DSN, so **with no
`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` the SDK is completely inert**: nothing initialises and
nothing is sent. Setup steps are in `plans/user-tasks/08-betterstack-sentry-dsn.md`.

Tracing and session replay are off (`tracesSampleRate: 0`, replays 0) and `sendDefaultPii` is
false. Because this is a lodging product, `src/lib/sentry-scrub.ts` runs on every event before it
leaves the process: it drops the user identity, cookies, auth headers and **the entire request
body** (guest name, phone, address, payment reference), and redacts emails, JWTs, vendor keys,
labelled secrets and token-bearing URLs from free text. `src/lib/sentry-scrub.test.ts` is the
proof; keep it green.

## Scripts

| Script | What |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit + Neon integration tests |
| `pnpm test:e2e` | Playwright + axe gate (build first; chromium, desktop + 375×667) |
| `pnpm db:generate` | Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply migrations (file a user-task for prod) |

## Layout

```
src/db/schema/      one file per domain: tenancy, billing, auth, rooms, booking,
                    partners, events, messaging, content, settings, support, audit
src/db/migrations/  0000 schema + 0001 extensions & the no-overlap constraint
src/lib/booking/    availability, rates, holds, summaries (engine; DB-backstopped)
src/lib/payments/   PaymentProvider interface + Paystack (per-tenant webhook)
src/lib/            env, result envelope, tenant/rbac, auth, mailer, sections, fonts,
                    sentry-scrub (strips guest PII + secrets from every error report)
src/app/[lang]/     tenant pages: sectioned homepage, /book flow, /sign-in,
                    /admin (staff: today/reservations/calendar/pricing/design),
                    /roadmap (platform), /platform (BAM's dashboard)
plans/user-tasks/   BAM's operator queue (NN-describe.md + 00 index)
```

Key invariants live in [CLAUDE.md](CLAUDE.md). The canonical build plan lives in the
wanderlearn repo: `plans/runbooks/stay-witus-plan.md`.
# stay-witus
