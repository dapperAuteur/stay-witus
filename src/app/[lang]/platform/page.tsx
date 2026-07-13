import { notFound } from "next/navigation";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { env, hasDatabase } from "@/lib/env";
import { getDictionary, hasLocale } from "@/lib/dictionaries";

export const dynamic = "force-dynamic";

// BAM's platform dashboard skeleton: tenants, per-tenant flags/pricing,
// billing (invoices + MoMo confirmation), cross-tenant support inbox, logs.
// GUARD: until the Better Auth platform-owner gate ships (identity
// workstream), this route only renders when PLATFORM_BOOTSTRAP=true —
// it 404s in any environment where that env var is unset.

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  if (!env.PLATFORM_BOOTSTRAP) notFound();
  const dict = await getDictionary(lang);

  const rows = hasDatabase
    ? await db()
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
        .from(tenants)
        .catch(() => [])
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">{dict.platform.title}</h1>

      <nav aria-label="Platform sections" className="mt-4">
        <ul className="flex flex-wrap gap-2 text-sm">
          <li className="rounded-full border border-slate-300 px-3 py-1.5 dark:border-slate-700">
            {dict.platform.tenants}
          </li>
          <li className="rounded-full border border-slate-300 px-3 py-1.5 dark:border-slate-700">
            {dict.platform.billing}
          </li>
          <li className="rounded-full border border-slate-300 px-3 py-1.5 dark:border-slate-700">
            {dict.platform.support}
          </li>
          <li className="rounded-full border border-slate-300 px-3 py-1.5 dark:border-slate-700">
            {dict.platform.logs}
          </li>
        </ul>
      </nav>

      <section aria-labelledby="tenants-heading" className="mt-8">
        <h2 id="tenants-heading" className="text-lg font-semibold">
          {dict.platform.tenants}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            No properties yet. Seeding and tenant CRUD land with the platform-admin
            workstream.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span>{t.name}</span>
                <code className="text-xs text-slate-500">{t.slug}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
