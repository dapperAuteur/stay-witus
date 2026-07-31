import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Server-runtime Sentry init. Loaded from src/instrumentation.ts's register() on the Node runtime.
// GUARDED ON THE DSN: with no SENTRY_DSN set, init is skipped entirely and the SDK is inert, so the
// app ships and runs unchanged until BAM provisions the Better Stack source and sets the var
// (plans/user-tasks/08-betterstack-sentry-dsn.md).
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only for now. No performance or tracing spend until BAM opts in.
    tracesSampleRate: 0,
    // Never auto-attach IP, cookies or user email; the beforeSend scrub is the second line of defense.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
