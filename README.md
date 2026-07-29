# Stay.WitUS

White-label hotel websites with real-time booking, self-service content management, a
vetted concierge partner network, and guest broadcast messaging. One deployment serves
every property: a hotel is a tenant row + a domain, themed to feel like its own site.

Built for markets where mobile money is how people pay (launch rails: Paystack GHS —
MTN MoMo, Telecel, AirtelTigo, cards) with per-tenant provider selection so properties
in Stripe-supported countries use Stripe instead.

## Stack

Next.js (App Router) · Neon Postgres + Drizzle · Better Auth (product-local) ·
Tailwind v4 · Mailgun · Cloudinary · Better Stack (via the Sentry SDK) · Vitest · pnpm

## Develop

```bash
pnpm install
cp .env.example .env   # fill values (see comments); never commit .env
pnpm db:migrate        # requires DATABASE_URL; applies src/db/migrations
pnpm dev
```

Without a `DATABASE_URL`, pages render a setup notice instead of crashing — useful for
UI work. `/api/health` reports which integrations are configured.

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
