import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Multi-tenant: pages resolve the tenant from the request Host header at
  // runtime (src/lib/tenant.ts), so responses must not be statically shared
  // across hosts. Tenant-facing routes opt into dynamic rendering themselves.
  poweredByHeader: false,
};

// Wrap with Sentry's build plugin. It is safe with no Sentry env set: without SENTRY_AUTH_TOKEN it
// simply skips source-map upload (you just get minified stack traces), and the runtime SDK stays
// inert without a DSN. org/project/authToken all come from env, so nothing secret is committed here.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Same intent as the older top-level `disableLogger: true`, which @sentry/nextjs 10.69 deprecates
  // (it warns on every build and points here). Strips the SDK's own debug logging from the bundle.
  webpack: { treeshake: { removeDebugLogging: true } },
});
