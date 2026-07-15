# HANDOFF — Stay.WitUS project context

*Draft for BAM's review, 2026-07-09. Purpose: let a Claude session opened in THIS repo take over with full context. Sessions here do NOT inherit the wanderlearn-directory memory — this file is the bridge. Read CLAUDE.md (invariants + working rules) alongside this.*

## What this is and why it exists

Stay.WitUS (`stay.witus.online`) is BAM's **resellable, runtime multi-tenant, white-label hotel-website product**: real-time room booking with mobile-money deposits, self-service CMS, a vetted concierge partner marketplace, guest broadcast messaging, and (later) a guest community hub. One deployment + one Neon DB serves every hotel; a customer is a tenant row + a domain.

**Origin:** BAM (in Ghana, July 2026) landed a paid job with a UK-based, Ghanaian-origin hotel owner in Osu, Accra: a before/after renovation 360° tour (separate engagement, $1,500/tour — see RealEstate.WitUS below) and then this: the hotel's full website. The owner must run the site himself; BAM only ships features/fixes and resells the platform to more properties. The owner also runs another property on Airbnb with a WhatsApp guest community — that playbook (area tips, "water is down/water is back", "museum trip Saturday, reserve your spot") is productized here as announcements + concierge + hub.

**Sibling ventures (separate products, do not conflate):** Wanderlearn = education (360° place-based learning). RealEstate.WitUS (`realestate.witus.online`) = before/after virtual tours, Insta360 X5 + RealSee dollhouse, diaspora remote-verification niche. Stay.WitUS = hotel websites. All under WitUS; registry at `gemini/witus/lib/products.ts`.

## Where everything lives

| Artifact | Location |
|---|---|
| **Canonical build plan** (approved by BAM in plan mode + 2 revisions) | `gemini/wanderlearn/plans/runbooks/stay-witus-plan.md` |
| Client proposal (Osu hotel; BAM prices + sends) | `gemini/wanderlearn/plans/proposals/osu-hotel/` |
| Operator task queue (01–07) | `gemini/wanderlearn/plans/user-tasks/` |
| Market research (diaspora, pricing, competitors) | `gemini/wanderlearn/plans/reports/` |
| Repo-local backlog docs | `plans/` here (gitignored): 01 pointer, 02 offline strategy, 03 owner customization ladder, 04 error handling |
| Tenancy machinery source-of-patterns | `claude/witus-learn` (tenants/domains/memberships, vercel-domains.ts, mailer) |
| Support-system source | `gemini/wanderlearn/wanderlearn-app` (`src/db/schema/support.ts` + actions + pages) |
| Payments webhook pattern | `gemini/tour-manager-os/app/api/stripe/webhook/route.ts` |

## Key decisions and their reasons (do not re-litigate casually)

1. **Runtime multi-tenant on witus-learn's lifted machinery** (NOT deploy-per-customer): new customer = tenant row + domain; bug fixes ship to all hotels at once. Proven by bettervice.club / elementarymba.com.
2. **Paystack for Ghana guest payments (GHS)** — Stripe cannot merchant Ghana businesses; Ghana FX Act 723 bars domestic USD pricing. **Per-tenant provider selection** (`tenants.payment.provider: paystack|stripe`) so Stripe-country customers work day one.
3. **Platform billing (tenant owner → BAM) is separate from guest payments:** card via BAM's own Stripe (B4C LLC, US), or **MoMo → BAM's MoMo** with claim-then-confirm (invoice shows BAM's number + reference; payer taps "I've sent it"; BAM confirms in /platform). Per-client pricing in `tenant_billing`.
4. **Mailgun, not Resend** (BAM's call; witus-learn mailer pattern, per-tenant `from` so hotel mail sends as the hotel).
5. **Booking default: instant book, 30% deposit** (all three modes built, owner-toggleable). Double-booking prevented at the DB: `unit_claims` exclusion constraint (migration 0001 — **applied to Neon successfully 2026-07-09**).
6. **Guests never need accounts to book**; optional magic-link "stay accounts" unlock hub/feedback/RSVP. Partners get magic-link self-edit only. Staff invite-only. **No shared WitUS OIDC** for customer tenants.
7. **Lean Dec-2026 launch** (Osu hotel reopening): booking + site + partner apply/vet/suspend + announcements + cultural/seasonal events. Q1 2027: guest hub, partner ratings, Airbnb/Booking.com iCal. P3 backlog: charge-to-room folio (settle cash/MoMo/card), channel manager, WhatsApp Business API, owner's second property (= another tenant row).
8. **No AI-generated content reaches guests.** English-first; es later, hand-translated.
9. **Owner customization target: "rung 2"** (section reorder/toggles/variants on curated layouts) — see `plans/03`; drag-and-drop rejected (breaks a11y/mobile gates). **DECIDED by BAM 2026-07-13 ("implement rung 2") and BUILT** (`src/lib/sections.ts` + `src/components/hotel/`); the `/admin/design` editor UI follows the identity workstream.

## Current state (as of this handoff)

*Update 2026-07-13:* booking engine (availability + rates + hold lifecycle, `src/lib/booking/`, Neon-integration-tested), root→/en locale redirect, rung 2 section control (theme JSONB + `src/lib/sections.ts` + section homepage), ecosystem footer + `/roadmap` (platform surface only), and Better Auth identity (magic link, RBAC helpers in `src/lib/rbac.ts`, self-closing bootstrap window on /platform) are built and merged, as are payments (PaymentProvider + Paystack, per-tenant webhook) and the public booking flow (/[lang]/book: search → hold → details → pay → done, session-guarded, progressive-enhancement forms). Operator queue moved repo-local: plans/user-tasks/ (01 cron secret, 02 auth env + owner, 03 Paystack per-tenant). Admin surfaces shipped 2026-07-14 (/[lang]/admin: today board, reservations + state machine, per-unit calendar with click-blockouts, pricing calendar + override CRUD, /admin/design rung-2 editor; requireStaffPage guard in src/lib/admin/guard.ts — pages AND layout must use it, they render concurrently). CMS shipped 2026-07-14 (/admin/content section editor + /admin/guide attractions CRUD; Cloudinary foundation in src/lib/media/cloudinary.ts — signed uploads only, upload widget waits on task 05 creds). Seeding done 2026-07-14: production Neon holds the platform tenant (stay.witus.online), the BAM Hotel demo (demo.stay.witus.online — domain attach is user-task 04), and the Osu skeleton (comingSoon, no domain); scripts/seed-*.ts are idempotent, run via pnpm seed:tenants / seed:demo. Demo hardening shipped 2026-07-14: nightly /api/cron/demo-reset (wipe+reseed strictly scoped to bam-hotel; src/lib/demo/), one-tap demo logins on the demo host's /sign-in (owner + front-desk credential accounts from DEMO_* env; passwords server-held), footer now links Sign in + Platform admin. Tests strip MAILGUN_* env so suites never send real mail. Promotions merged + migration 0002 applied 2026-07-14 (consent copy APPROVED); partners workstream shipped same day (public /partners/apply, /admin/partners vet queue, magic-link self-edit at /partner/[token], suspension revokes tokens). Events+RSVP shipped 2026-07-14 (public /events with race-safe capacity RSVP, /admin/events CRUD + reservation lists; demo domain LIVE after Claude attached it via API — the in-app Check is now attach-then-verify). ux-trust bundle 2026-07-14: /admin/settings (owners now manage cancellation policy + all operational knobs), policy shown at booking+confirmation, /admin/rooms (edit + Cloudinary signed photo upload), public /rooms/[slug] detail pages, clickable room cards with thumbnails, sticky tenant header with Book. click-complete bundle 2026-07-14: whole-card stretched links (rooms/events), A4 recovery email cron + Pay-now retry, room-type create + units CRUD (delete only when claim-free, else deactivate). Visual redesign DISCUSSION open at plans/11 (directions A/B/C). TEMPLATES shipped 2026-07-14 (src/lib/templates.ts registry + tokens; theme.templateKey; Editorial Boutique flagship = fullbleed scrim hero + editorial room rows + accent bands + display type; Warm Minimal = stone-* carve-out BAM-approved; Classic = default so existing tenants unchanged; picker in /admin/design; demo defaults editorial via seed/reset). PLATFORM ADMIN core shipped 2026-07-14 (bundle/platform-admin): /platform/tenants (create comingSoon-first, flags editor), /platform/billing (per-tenant pricing, invoice create+email with MoMo instructions, claim queue, confirm/void), owner-side /admin/billing (copy-button MoMo pay + I've-sent-it claim). LESSON: neon-http wraps pg errors — ALWAYS pgErrorCode(), never error.code (fixed latent bugs in partners/events/rooms/tenants). E2E GATE shipped 2026-07-14 (playwright.config.ts + tests/e2e/: host-resolver-rules map real tenant hostnames to localhost so multi-tenant routing runs production-identical; axe serious/critical fails; read-only vs demo data). SEO core shipped (src/lib/seo.ts: tenantMetadata with title.absolute escaping the root template — white-label; hotelJsonLd on tenant homepages; app/robots.ts; per-host /sitemap.xml route listing only that tenant's pages). SUPPORT shipped 2026-07-15 (src/lib/support.ts lifecycle incl. dispute-reopens; staff /admin/support, BAM /platform/support; sendToInbox in src/lib/witus-inbox.ts forwards thread-created events HMAC-signed, ids only - no content/PII). Remaining-work tracker: plans/06-remaining-work-tracker.md — run its docs checklist after every task. Sections below describe the 07-09 baseline.

- **Deployed skeleton:** scaffold merged to `main`; `feat/infra-env-analytics` merged (STORAGE_ env, Vercel Analytics, env docs); `feat/platform-landing` pushed (platform landing on stay.witus.online — DB-free host detection) — check PR state.
- **Infra live:** GitHub `dapperAuteur/stay-witus` · Vercel `bam-apps/stay-witus` (analytics enabled, domain `stay.witus.online` attached by BAM) · Neon via marketplace (`STORAGE_DATABASE_URL`) · **migrations 0000+0001 applied** — schema + citext + btree_gist + `unit_claims_no_overlap` are live.
- **Not yet:** Better Auth wiring (auth schema exists; `/platform` is `PLATFORM_BOOTSTRAP`-gated placeholder) · booking engine logic · all admin UIs · Paystack/Stripe providers · Mailgun DNS (task 04) · witus-inbox/outbox wiring · seeding (no tenants rows yet) · `products.ts` registry entry.
- **Client engagement:** proposal awaits BAM pricing + send (task 01). Paystack business verification = critical path (task 02). Owner content due mid-Oct (task 05).

## Short-term plan (workstream order, from the canonical runbook)

1. **Booking engine** (largest, most novel): availability query over `unit_claims` (lazy hold expiry), rate resolution (base + `rate_overrides` by priority/dow), hold lifecycle (create on search-select, 15 min, sweep in cron), reservation create with `FOR UPDATE SKIP LOCKED` unit pick. Vitest for rate/date math; integration test the exclusion constraint (two concurrent claims → second fails).
2. **Identity:** Better Auth (magic link + staff invites), `tenant_memberships` RBAC helpers, platform-owner gate replacing `PLATFORM_BOOTSTRAP`.
3. **Payments:** `PaymentProvider` interface; Paystack impl (init + `x-paystack-signature` HMAC-SHA512 webhook, `payments.providerRef` idempotency); Stripe impl later.
4. **Public booking flow** (mobile-first 375×667): search → hold → guest details → pay/confirm → confirmation + stay-account CTA.
5. **Admin:** today dashboard, reservations, per-unit calendar with click-blockouts, pricing calendar.
6. **CMS + events + partners + announcements**, then **support lift** (finish attachment wiring), **branding editor**, **/platform** (tenants CRUD, flags, billing incl. MoMo confirm queue, cross-tenant support, audit logs), SEO/CWV, seeding (platform tenant + Osu hotel tenant).

## Long-term plan

P2 (Q1 2027): guest hub, partner ratings, iCal sync, paid ticketing, Stripe guest-payments, es locale. P3: folio/charge-to-room, channel manager integration, WhatsApp Business API, multi-property owners, repeat-guest recognition. Resale motion: expo circuit (London Oct 2026, Accra Dec 2026) selling to developers/agents; reprice before customer #2 (see runbook §resale + proposal appendix ranges).

## Working rules that bit us already (respect them)

- **Check `git branch --show-current` before EVERY commit** — BAM's GitHub first-push renamed `feat/scaffold` to `main` mid-session; the `.githooks/pre-commit` guard (activate: `git config core.hooksPath .githooks`) saved us once already.
- Migrations always file a run-migration user-task (wanderlearn queue) — BAM runs them.
- `drizzle-kit` reads env through `drizzle.config.ts`'s own loader (`.env`, `.env.local`, STORAGE_ prefix) — don't "fix" it back to plain DATABASE_URL.
- Never read `.env` files. Never commit on main. BAM merges everything.
- Envelope `{ok,data}|{ok,error,code}` on every action/route; slate-* neutrals; 44px targets; no em-dashes in microcopy.
