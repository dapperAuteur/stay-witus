import {
  endSessionEndpointFromDiscovery,
  silentSsoEndpointFromDiscovery,
} from "@/lib/silent-sso";

// Central env access. Never read .env files in tooling; values come from
// process.env (Vercel env / local .env loaded by Next).

export const env = {
  // Neon via the Vercel Marketplace integration with the "STORAGE_" prefix
  // (BAM's setup). Plain DATABASE_URL is the fallback for local dev or a
  // manually provisioned database — verify the exact names in Vercel's env
  // list rather than assuming (authoritative-values rule).
  DATABASE_URL: process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,

  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
  MAILGUN_REGION: process.env.MAILGUN_REGION ?? "us",
  MAIL_FROM: process.env.MAIL_FROM ?? "Stay.WitUS <no-reply@localhost>",

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  PLATFORM_MOMO_NUMBER: process.env.PLATFORM_MOMO_NUMBER,
  PLATFORM_MOMO_NAME: process.env.PLATFORM_MOMO_NAME,

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  VERCEL_DOMAINS_TOKEN: process.env.VERCEL_DOMAINS_TOKEN,
  VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,

  // "Sign in with WitUS" — ecosystem OIDC client against accounts.witus.online.
  // Registered as slug `stay` in gemini/witus/lib/identity/clients.ts, whose ONLY
  // redirect URI is https://stay.witus.online/api/auth/oauth2/callback/witus. That
  // single registration is deliberate: see shouldShowWitusSignIn in src/lib/witus-sso.ts.
  // Optional, so the provider and the button stay off until BAM sets the client id.
  WITUS_OIDC_CLIENT_ID: process.env.WITUS_OIDC_CLIENT_ID,
  WITUS_OIDC_CLIENT_SECRET: process.env.WITUS_OIDC_CLIENT_SECRET,
  WITUS_OIDC_DISCOVERY_URL: process.env.WITUS_OIDC_DISCOVERY_URL,

  WITUS_INBOX_URL: process.env.WITUS_INBOX_URL,
  WITUS_INBOX_HMAC_SECRET: process.env.WITUS_INBOX_HMAC_SECRET,
  OUTBOX_URL: process.env.OUTBOX_URL,
  OUTBOX_HMAC_SECRET: process.env.OUTBOX_HMAC_SECRET,
  OUTBOX_TRIGGER_ENABLED: process.env.OUTBOX_TRIGGER_ENABLED === "true",

  CRON_SECRET: process.env.CRON_SECRET,

  // BAM Hotel demo logins (plans/07). Emails identify the two demo accounts;
  // passwords are server-held — the demo buttons POST empty bodies and the
  // route supplies credentials, so secrets never reach a browser.
  DEMO_VISITOR_USER_EMAIL: process.env.DEMO_VISITOR_USER_EMAIL,
  DEMO_VISITOR_PASSWORD: process.env.DEMO_VISITOR_PASSWORD,
  DEMO_ADMIN_USER_EMAIL: process.env.DEMO_ADMIN_USER_EMAIL,
  DEMO_ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD,
  ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
  PLATFORM_BOOTSTRAP: process.env.PLATFORM_BOOTSTRAP === "true",
} as const;

export const hasDatabase = Boolean(env.DATABASE_URL);
export const hasMailgun = Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);
export const hasStripePlatform = Boolean(env.STRIPE_SECRET_KEY);
export const hasVercelDomains = Boolean(env.VERCEL_DOMAINS_TOKEN && env.VERCEL_PROJECT_ID);
export const hasWitusInbox = Boolean(env.WITUS_INBOX_URL && env.WITUS_INBOX_HMAC_SECRET);
/** Gates the genericOAuth provider AND the sign-in button. Both stay off without it. */
export const hasWitusSso = Boolean(env.WITUS_OIDC_CLIENT_ID && env.WITUS_OIDC_CLIENT_SECRET);
export const hasDemoLogin = Boolean(
  env.DEMO_VISITOR_USER_EMAIL &&
    env.DEMO_VISITOR_PASSWORD &&
    env.DEMO_ADMIN_USER_EMAIL &&
    env.DEMO_ADMIN_PASSWORD,
);

// --- Ecosystem SSO endpoints -------------------------------------------------
//
// Both derive from the discovery URL this app is ALREADY configured with, so
// accounts.witus.online is named in exactly one place in this repo (below) and
// nowhere else asserts a URL the IdP owns (authoritative-values rule).
//
// Both are ALSO gated a second time at every call site by showWitusSignIn()
// (src/lib/witus-sso.ts). These constants only answer "is this app a configured
// ecosystem client?" — they cannot see the request host, and the host is what
// keeps a hotel tenant's guests off accounts.witus.online.

/**
 * Labelled fallback, not an assumed value: the IdP owns this URL, so the env var
 * wins and this is the default to override. Exported so src/lib/auth.ts and the
 * endpoint derivations below cannot drift into probing a different host than the
 * one the click actually signs in against.
 */
export const WITUS_OIDC_DISCOVERY_FALLBACK =
  "https://accounts.witus.online/api/idp/.well-known/openid-configuration";

const witusDiscoveryUrl = env.WITUS_OIDC_DISCOVERY_URL ?? WITUS_OIDC_DISCOVERY_FALLBACK;

/**
 * Where the sign-in page's silent "Continue as ..." check asks the IdP who the
 * browser is. `null` unless the ecosystem OIDC client is configured, because an
 * affordance the visitor cannot complete is worse than no affordance.
 */
export const witusSilentSsoEndpoint: string | null = hasWitusSso
  ? silentSsoEndpointFromDiscovery(witusDiscoveryUrl)
  : null;

/**
 * Where sign-out ends the SHARED WitUS session (BAM's decision, 2026-08-30:
 * signing out of one WitUS app signs you out of all of them).
 *
 * client_id IS REQUIRED, not optional: Better Auth's endSession endpoint rejects a
 * post_logout_redirect_uri with invalid_request unless the request carries either a
 * verifiable id_token_hint or an explicit client_id, and we have no id_token here.
 * Baked in on the SERVER so nothing client-side ever reads the raw env.
 */
export const witusEndSessionEndpoint: string | null = (() => {
  if (!hasWitusSso) return null;
  const base = endSessionEndpointFromDiscovery(witusDiscoveryUrl);
  if (!base) return null;
  return `${base}?client_id=${encodeURIComponent(env.WITUS_OIDC_CLIENT_ID as string)}`;
})();
