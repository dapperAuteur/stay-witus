import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Client-runtime Sentry init. Reads the PUBLIC DSN (inlined at build time). Guarded: with no
// NEXT_PUBLIC_SENTRY_DSN the SDK is inert, so nothing is sent and nothing changes for guests.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only. No tracing and no session replay: a replay of a booking form would record a
    // guest's name, phone and card entry, which is exactly what we refuse to send off-site.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

// Instruments App Router client navigations for Sentry (no-op when not initialized).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
