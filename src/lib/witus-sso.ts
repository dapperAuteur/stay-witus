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

/** What the tenant lookup told us. `unknown` means it threw, e.g. database down. */
export type TenantOutcome = "none" | "tenant" | "unknown";

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
 * that host, and no tenant resolved. The tenant check is redundant today — the branded
 * host should never be in `tenant_domains` — but it means that if it ever is, making the
 * branded host serve a hotel, the button disappears rather than appearing on a
 * white-labelled page.
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
  return tenantOutcome === "none";
}

/** Resolves the tenant, mapping a thrown lookup to `unknown` rather than to "no tenant". */
async function tenantOutcome(): Promise<TenantOutcome> {
  try {
    return (await resolveTenant()) ? "tenant" : "none";
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
