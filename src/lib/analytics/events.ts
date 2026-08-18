/**
 * Event taxonomy for Stay.WitUS.
 *
 * The ecosystem shares ONE PostHog project, separated by the `app` property that
 * posthog-provider registers on load. Two rules keep that project readable, and both
 * are cheap now and expensive to retrofit once data has landed:
 *
 *   1. `snake_case`, object first, verb in past tense — `route_viewed`.
 *   2. NEVER put the app name in the event name. `stay_signin_started` is wrong: it
 *      makes the same action from two apps look like two events and kills the
 *      cross-app comparison that sharing a project exists to enable. The `app`
 *      property already carries that.
 *
 * Shared lifecycle events (the SHARED_EVENTS block) use identical names in every
 * ecosystem app, so "where do people fall out of sign-in" is answerable across all of
 * them at once. Do not rename these here without renaming them everywhere.
 *
 * See gemini/witus/plans/26-posthog-ecosystem-rollout.md for the full contract and
 * gemini/witus/lib/analytics/INTEGRATE.md for the integration playbook.
 */

/** Slug carried on every event so this app's data stays separable in the shared project. */
export const ANALYTICS_APP = "stay-witus";

/**
 * Events with identical names across every ecosystem app. Names are contractual.
 *
 * Declared here so the contract is visible and a future sign-in instrumentation uses
 * the ecosystem names rather than inventing new ones. Nothing emits them yet: the
 * sign-in page is a plain form driven by a server action so it keeps working without
 * client JS (see src/app/[lang]/sign-in), and firing these would mean converting it to
 * a client component — a real cost for an analytics nicety. Wire them if and when that
 * page gains client JS for its own reasons.
 */
export const SHARED_EVENTS = {
  signinStarted: "signin_started",
  signinSucceeded: "signin_succeeded",
  signinFailed: "signin_failed",
} as const;

/**
 * Events specific to Stay.WitUS.
 *
 * DELIBERATELY MINIMAL, and the booking funnel is the reason. This app holds guest
 * names, phone numbers, email addresses, payment references and Ghana mobile-money
 * details; the booking and payment surfaces (/[lang]/book, /[lang]/book/details,
 * /[lang]/book/done) are instrumented with PAGEVIEWS ONLY. No event here carries a
 * price, a nightly rate, a total, a phone number, a mobile-money number, or a payment
 * provider identifier (Paystack / MoMo / Stripe / a tenant's provider choice).
 *
 * That is not caution for its own sake. Amounts plus a route plus a timestamp
 * reconstruct an individual guest's transaction inside a THIRD-PARTY analytics vendor
 * that sits outside the Sentry scrubbing this repo already applies to error payloads
 * (src/lib/sentry-scrub.ts), and a payment-provider identifier tells an outside reader
 * which rails a named hotel runs on. Conversion questions that matter here are ratios
 * between route views — how many people who reach /book reach /book/done — which the
 * pageview stream already answers without any of that data leaving the app.
 *
 * If a funnel event is ever genuinely needed, add one that carries a room-type SLUG and
 * nothing else. Identify entities by slug or id, never display name or amount.
 */
export const EVENTS = {
  /** An explicit route view. capture_pageview is off — Next's client router would
   *  fire it once and then lie — so route changes are reported deliberately.
   *  The pathname is passed through safePathname() first (see ./pathname). */
  routeViewed: "route_viewed",
  ...SHARED_EVENTS,
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
