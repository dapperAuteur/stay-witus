import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Next.js instrumentation hook. Loads the right Sentry config per runtime, and reports server-side
// App Router errors via onRequestError. Everything is inert without a SENTRY_DSN (see the configs).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

// Captures errors thrown while rendering or serving a request. We tag the request HOST, which is
// how tenants resolve in this app (src/lib/tenant.ts), so a crash is attributable to a hotel
// WITHOUT a database lookup in the error path and without carrying any guest PII.
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const raw = request.headers as unknown;
  let host: string | undefined;
  if (raw instanceof Headers) host = raw.get("host") ?? raw.get("x-forwarded-host") ?? undefined;
  else if (raw && typeof raw === "object") {
    const h = raw as Record<string, unknown>;
    const v = h.host ?? h["x-forwarded-host"];
    if (typeof v === "string") host = v;
  }
  Sentry.withScope((scope) => {
    if (host) scope.setTag("tenant.host", host);
    Sentry.captureRequestError(err, request, context);
  });
};
