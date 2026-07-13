# Stay.WitUS — repo identity (don't confuse ecosystem repos)

This repo is **Stay.WitUS** (`stay.witus.online`): the runtime multi-tenant, white-label
hotel-website product. One deployment + one Neon DB serves every hotel tenant. It is NOT
Wanderlearn (education), NOT RealEstate.WitUS (virtual tours), NOT witus-learn (LMS) —
though its tenancy machinery is lifted from witus-learn. Canonical product registry:
`gemini/witus/lib/products.ts`. Canonical build plan:
`gemini/wanderlearn/plans/runbooks/stay-witus-plan.md`.

## Architecture invariants

- **Tenant isolation:** every hotel-domain table carries `tenantId`; all tenant-facing
  queries flow through `requireTenant()` (src/lib/tenant.ts). Never query across tenants
  except in `/platform` (platform-owner surfaces).
- **Double-booking is a DB guarantee:** `unit_claims` + the `unit_claims_no_overlap`
  exclusion constraint (migration 0001). Never bypass it with raw writes; unit selection
  uses `FOR UPDATE SKIP LOCKED` in a transaction, the constraint is the backstop.
- **Payments:** guest→hotel rails are per-tenant (`tenants.payment`: Paystack for Ghana,
  Stripe where supported) behind a `PaymentProvider` interface. Platform billing
  (tenant owner → BAM) is separate: BAM's Stripe or MoMo claim-then-confirm
  (src/db/schema/billing.ts). Domestic Ghana pricing is GHS only (FX Act 723).
- **Email is Mailgun** (src/lib/mailer.ts), per-tenant `from` — hotel mail never says
  Stay.WitUS. Not Resend.
- **Auth is product-local Better Auth.** No shared WitUS OIDC for customer tenants
  (learnwitus white-label precedent). Guests book accountless; magic-link stay accounts
  are optional. BAM = `users.isPlatformOwner`.
- **No AI-generated content reaches guests** (ecosystem rule): copy is human-written;
  seeds are placeholders owners rewrite.

## Working rules (WitUS shared)

- **Branch hygiene:** never commit on `main` — branch (`feat/ fix/ chore/ docs/`),
  commit often, push, stop. BAM merges. Check `git branch --show-current` before EVERY
  commit. Activate the guard once per clone: `git config core.hooksPath .githooks`.
- **Conventional Commits**, `type(scope): summary` under 70 chars.
- **Operator tasks:** anything BAM must do outside the editor becomes
  `plans/user-tasks/NN-slug.md` (venture-level queue currently lives in
  `gemini/wanderlearn/plans/user-tasks/`). Migrations ALWAYS file a run-migration task —
  a merged migration that isn't applied 500s the next deploy.
- **Conventions:** `{ok,data}|{ok,error,code}` envelope for every action/route
  (src/lib/result.ts); Tailwind only, `slate-*` neutrals; WCAG 2.1 AA; 44px touch
  targets; focus-visible ring; mobile-first at 375×667; dictionaries via
  `getDictionary` with en.json as source of truth (es must be hand-translated); no
  em-dashes in microcopy; named exports; kebab-case files. Full doc:
  `gemini/witus/docs/shared-ui-ux-dx.md`.
- **Never read .env files.** Secrets come from Vercel/env; have BAM paste values himself.
