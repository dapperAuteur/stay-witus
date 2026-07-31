import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Edge-runtime Sentry init (the locale middleware and any edge route). Same DSN guard as the
// server config: inert with no SENTRY_DSN. Loaded from src/instrumentation.ts's register().
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
