import { headers } from "next/headers";
import { cache } from "react";
import { env, hasWitusSso } from "@/lib/env";
import { normalizeHost, resolveTenant } from "@/lib/tenant";

// "Sign in with WitUS" is scoped to the WitUS-BRANDED platform host only.
//
// This is the white-label invariant in CLAUDE.md, which reads "No shared WitUS OIDC
// for CUSTOMER TENANTS (learnwitus white-label precedent)" — scoped to tenants, so the
// platform surface is in bounds. The reason is concrete: hotel mail sends from the
// hotel's own domain under the hotel's brand and never says Stay.WitUS (src/lib/auth.ts,
// src/lib/mailer.ts). Offering "Sign in with WitUS" on a hotel's own site would redirect
// that hotel's guests to accounts.witus.online and reveal the shared backend, which is
// exactly what the rule exists to prevent.
//
// Defence in depth, three independent layers — any one alone is sufficient:
//
//   1. This gate. The button does not render off the branded host, and the server
//      action re-checks it (a server action is a public POST endpoint, so rendering
//      logic alone would not be a control).
//   2. The IdP registry. Slug `stay` registers ONE redirect URI, the branded host's.
//      A tenant domain attempting the flow sends an unregistered redirect_uri and the
//      IdP returns 400. Even a bug here fails closed rather than leaking.
//   3. hasWitusSso. No client credentials, no provider and no button.
//
// Layer 2 is why tenant hosts must never be added to that entry's extraRedirectUris.
//
// The decision itself is split into a pure function so it is unit-testable without
// mocking next/headers or the database (see witus-sso.test.ts) — no test in this repo
// uses vi.mock, and a security gate is the last place to start.

/**
 * What the tenant lookup told us.
 *
 * `platform` is NOT a nicety — it is the difference between this feature working and not.
 * `scripts/seed-tenants.ts` registers `stay.witus.online` itself as a domain of the seeded
 * PLATFORM tenant (`flags.platform: true`), and `src/db/schema/tenancy.ts` says so in as many
 * words. So on the branded host a tenant genuinely does resolve, and collapsing that into
 * `tenant` would hide the WitUS button on the only host it is meant to appear on.
 *
 * `unknown` means the lookup threw, e.g. the database is down.
 */
export type TenantOutcome = "none" | "platform" | "tenant" | "unknown";

/**
 * The host this deployment treats as its WitUS-branded origin, derived from
 * BETTER_AUTH_URL rather than a hardcoded "stay.witus.online".
 *
 * BETTER_AUTH_URL is already the authoritative origin for the deployment — Better Auth
 * builds its callback URLs from it, so it is by definition the host whose redirect URI
 * is registered with the IdP. Hardcoding the production hostname would break local dev
 * and previews, and would restate a value another system owns (authoritative-values
 * rule).
 *
 * Returns null on a missing or malformed URL, which makes the caller fail closed.
 */
export function brandedHostFrom(betterAuthUrl: string | undefined): string | null {
  if (!betterAuthUrl) return null;
  try {
    return normalizeHost(new URL(betterAuthUrl).host);
  } catch {
    return null;
  }
}

/**
 * The whole decision, as a pure function.
 *
 * Requires ALL of: credentials configured, a known branded host, the request arriving on
 * that host, and a tenant outcome of `none` or `platform`.
 *
 * THIS USED TO REQUIRE `none` AND THAT WAS A BUG. The comment here previously read "the
 * tenant check is redundant today — the branded host should never be in `tenant_domains`".
 * It is in there: `scripts/seed-tenants.ts` does `ensureDomain(platformId,
 * "stay.witus.online")`, and `src/db/schema/tenancy.ts` documents exactly that. So
 * `getTenantByHost` returns the platform tenant on the branded host, the outcome was
 * `tenant`, and the button would never have rendered anywhere — dead on arrival, and
 * silently, because "no WitUS button" is also what correct white-label behaviour looks
 * like. Found 2026-09-02 while wiring the same gate into realestate-witus, which seeds its
 * platform host the same way.
 *
 * An allow-list, deliberately: only `none` and `platform` pass. A new outcome added later
 * fails closed by default rather than inheriting permission.
 *
 * Fails CLOSED on every uncertainty, including `unknown`. The asymmetry is the point:
 * a false negative costs BAM a magic link, a false positive leaks the shared backend to
 * a hotel's guests.
 */
export function shouldShowWitusSignIn(input: {
  hasCredentials: boolean;
  brandedHost: string | null;
  requestHost: string | null;
  tenantOutcome: TenantOutcome;
}): boolean {
  const { hasCredentials, brandedHost, requestHost, tenantOutcome } = input;
  if (!hasCredentials) return false;
  if (!brandedHost || !requestHost) return false;
  if (normalizeHost(requestHost) !== brandedHost) return false;
  return tenantOutcome === "none" || tenantOutcome === "platform";
}

/** Resolves the tenant, mapping a thrown lookup to `unknown` rather than to "no tenant". */
async function tenantOutcome(): Promise<TenantOutcome> {
  try {
    const tenant = await resolveTenant();
    if (!tenant) return "none";
    // The platform tenant owns the branded host itself (seed-tenants.ts). A HOTEL tenant
    // resolving here is the case that must stay dark.
    return tenant.flags?.platform ? "platform" : "tenant";
  } catch {
    return "unknown";
  }
}

/**
 * Show the WitUS sign-in option for this request?
 *
 * Memoized per request: the sign-in page and the server action both call it, and there
 * is no reason to resolve the tenant twice.
 */
export const showWitusSignIn = cache(async (): Promise<boolean> => {
  const h = await headers();
  return shouldShowWitusSignIn({
    hasCredentials: hasWitusSso,
    brandedHost: brandedHostFrom(env.BETTER_AUTH_URL),
    requestHost: h.get("host"),
    tenantOutcome: await tenantOutcome(),
  });
});

/**
 * THE SAME GATE, under the name the rest of the ecosystem wiring reads by.
 *
 * "Sign in with WitUS" was the first thing this gate protected, but it is not the
 * only one. Two more surfaces cross to accounts.witus.online and must be dark on a
 * hotel tenant domain for exactly the same reason:
 *
 *   - the silent "Continue as <name>" probe on the sign-in page, and
 *   - global sign-out, which redirects to the IdP's endsession endpoint.
 *
 * A single request from a hotel's own domain both reveals that the ecosystem exists
 * AND tells it that someone visited that hotel — so this is not merely "don't show a
 * button", it is "don't touch that origin at all".
 *
 * Deliberately an ALIAS — the same binding, not a second implementation. A parallel
 * `showEcosystemSso()` with its own copy of the host comparison is exactly how one
 * of these three surfaces ends up gated differently from the others after someone
 * edits one and not the other. witus-sso.test.ts pins the identity so it stays one.
 */
export const witusEcosystemEnabled = showWitusSignIn;
