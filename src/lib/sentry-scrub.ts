import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Sentry `beforeSend` scrubber for Stay.WitUS.
 *
 * Why this file exists
 * --------------------
 * This is a lodging product. A crash generated while someone books a room can carry, in its
 * message, its request URL, or its request body: a guest's name, email, phone and address, a
 * payment reference, a Paystack or Stripe key, a staff-invite or partner-edit token, a Better Auth
 * magic link, or the CRON_SECRET. Every one of those is a live credential or a piece of guest PII,
 * and shipping it to a third-party error service puts it in a second, less-guarded place.
 *
 * The bias is deliberate: REDACT WHEN UNSURE. An over-redacted crash costs a few minutes of triage;
 * an under-redacted one costs a guest their privacy or a tenant their account. The scrubber never
 * returns null, so we keep the crash signal (stack, route shape, tenant host) with the secrets and
 * the PII taken out of it.
 *
 * Pure and dependency-free apart from the Sentry event type, so it is directly unit-testable.
 * See sentry-scrub.test.ts.
 */

/** Query-param names that carry (or plausibly carry) a bearer secret or guest PII. Matched
 *  case-insensitively as a substring, so `callbackToken`, `access_token`, `guest_email` all trip. */
const SECRET_PARAM_RE =
  /(token|secret|code|otp|passcode|password|pwd|pin|key|jwt|sig|signature|hash|auth|credential|session|magic|invite|nonce|email|phone|reference)/i;

/** Path prefixes that are token-redemption or credential endpoints by construction in THIS app:
 *  Better Auth (magic link), staff invites, partner edit links, unsubscribe, demo login, the cron
 *  routes (gated by CRON_SECRET), the Cloudinary signing route, and the Paystack webhook. */
const SECRET_PATH_RE =
  /(^|\/)(api\/auth|api\/demo-login|api\/cron|api\/unsubscribe|api\/media\/sign|api\/webhooks|invite|partner|accept|reset|reset-password|set-password|magic-link|confirm|activate)(\/|$)/i;

/** A path segment shaped like a generated token. Invite and partner tokens are
 *  `randomBytes(24).toString("base64url")` (32 chars) and Better Auth tokens are similar.
 *  Deliberately loose: a human-authored room or tenant slug is not 20+ random-alphabet chars. */
const TOKENISH_SEGMENT_RE = /^[A-Za-z0-9_-]{20,}$/;

/** Absolute http(s) URLs. Trailing punctuation is excluded so we replace the URL, not the prose. */
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

/** Email addresses anywhere in free text. Guests book accountless with an email, so a booking
 *  crash ("duplicate key ... guest_email=ama@example.com") leaks PII through the message alone. */
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** A JWT or signed session token pasted into a message or a header value. */
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** Vendor keys recognisable on sight: Paystack and Stripe secret/public keys. */
const VENDOR_KEY_RE = /\b[sp]k_(?:live|test)_[A-Za-z0-9]{6,}\b/g;

/**
 * A raw secret that is NOT a URL: `Password: hunter2`, `CRON_SECRET=abc...`, `reference is xyz`.
 * The separator (`:` `=` `is`) is REQUIRED, or "pin down the rate" would be mangled in every
 * message. Covers the payment reference too: it identifies one guest's transaction.
 */
const SECRET_LABEL_RE =
  /\b(pin|password|passcode|secret|api[-_\s]?key|bearer|authorization|cron[-_\s]?secret|access[-_\s]?code|verification[-_\s]?code|one[-\s]?time[-\s]?code|reference|providerRef)\b\s*(?:is|:|=)\s*("?)([^\s.,;"]{3,})\2/gi;

export const REDACTED_LINK = "[redacted link]";
export const REDACTED = "[redacted]";
export const REDACTED_EMAIL = "[redacted email]";

/**
 * Is this URL carrying a secret or guest PII that must never leave the app?
 * Returns TRUE (redact) for anything unparseable, which is exactly the case where we cannot reason
 * about it, and the rule is redact when unsure.
 */
export function isSensitiveUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }

  for (const key of url.searchParams.keys()) {
    if (SECRET_PARAM_RE.test(key)) return true;
  }

  if (SECRET_PATH_RE.test(url.pathname)) return true;

  // Catches a future /whatever/<token> route nobody remembered to list above, which is the whole
  // reason this is a heuristic rather than an allowlist.
  return url.pathname.split("/").some((seg) => TOKENISH_SEGMENT_RE.test(seg));
}

/** Mask a redacted URL down to something safe to keep for triage: origin plus path with
 *  token-shaped segments replaced, never the query string. Knowing "a crash happened under
 *  /en/invite/<token>" is the useful half; the token itself is the dangerous half. */
function describe(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname
      .split("/")
      .map((seg) => (TOKENISH_SEGMENT_RE.test(seg) ? "<token>" : seg))
      .join("/");
    return `${url.origin}${path}${url.search ? "?<redacted>" : ""}`;
  } catch {
    return REDACTED_LINK;
  }
}

/**
 * Remove every bearer secret and every piece of guest PII from a free-text string: token-bearing
 * URLs collapse to origin plus masked path, emails, JWTs and vendor keys become placeholders, and
 * labelled raw secrets lose their value. Everything else survives so the crash stays readable.
 */
export function redactText(text: string): string {
  let out = text.replace(URL_RE, (match) => (isSensitiveUrl(match) ? describe(match) : match));
  out = out.replace(JWT_RE, REDACTED);
  out = out.replace(VENDOR_KEY_RE, REDACTED);
  out = out.replace(SECRET_LABEL_RE, (_m, label: string, _q: string, value: string) =>
    value.startsWith("[redacted") ? `${label}: ${value}` : `${label}: ${REDACTED}`,
  );
  out = out.replace(EMAIL_RE, REDACTED_EMAIL);
  return out;
}

/**
 * Redact a BARE query string (`from=2026-08-01&token=xyz`) by param NAME: any param whose name
 * trips `SECRET_PARAM_RE` loses its value entirely, the rest get the free-text pass.
 *
 * This needs its own function because Sentry ships `request.query_string` as a separate field from
 * `request.url`, and a bare query string is not a parseable URL. `redactText`'s URL pass therefore
 * cannot see it, and without this the token survives in a field of its own. Found by the test
 * rather than by reading the code.
 */
export function redactQueryString(qs: string): string {
  const leading = qs.startsWith("?") ? "?" : "";
  const params = new URLSearchParams(leading ? qs.slice(1) : qs);
  const parts: string[] = [];
  for (const [key, value] of params) {
    parts.push(`${key}=${SECRET_PARAM_RE.test(key) ? REDACTED : redactText(value)}`);
  }
  return leading + parts.join("&");
}

/**
 * `beforeSend` hook. Strips account identity, cookies, auth headers and the whole request body,
 * then runs the free-text redaction over the message, the exception values and the breadcrumbs.
 * Returns the event (never null) so the crash signal survives without the credentials.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrub = (s: string | undefined): string | undefined => (s ? redactText(s) : s);

  if (event.message) event.message = scrub(event.message);

  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrub(ex.value);
  }

  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrub(crumb.message);
    // Breadcrumb data is an arbitrary vendor or app payload (fetch URLs, form values); we cannot
    // reason about its shape, so it goes rather than gets filtered.
    delete crumb.data;
  }

  // Never ship the account identity or the network origin.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  if (event.request) {
    if (typeof event.request.url === "string") event.request.url = scrub(event.request.url);
    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactQueryString(event.request.query_string);
    }
    // Booking and admin POSTs carry guest names, phone numbers, addresses, stay dates and payment
    // references. There is no version of that body we want in a third-party service, so it goes
    // whole rather than field by field.
    delete event.request.data;
    delete event.request.cookies;
    const headers = event.request.headers as Record<string, string> | undefined;
    if (headers) {
      delete headers.cookie;
      delete headers.authorization;
      delete headers["set-cookie"];
      delete headers["x-paystack-signature"];
      delete headers["x-witus-signature"];
    }
  }

  // Extra is a free-form payload attached at capture time; scrub its strings too.
  if (event.extra) {
    for (const [key, value] of Object.entries(event.extra)) {
      if (typeof value === "string") event.extra[key] = redactText(value);
    }
  }

  return event;
}
