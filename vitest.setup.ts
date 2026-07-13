// Vitest runs outside Next, so local env files are loaded here. Real env vars
// win over file values (Node semantics), matching drizzle.config.ts's loader.
// Integration suites skip themselves when no database URL is present.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File absent (CI) — fine.
  }
}
