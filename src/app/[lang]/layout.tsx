import { notFound } from "next/navigation";
import { SessionBar } from "@/components/session-bar";
import { TenantHeader } from "@/components/hotel/tenant-header";
import { brandCssVars } from "@/lib/brand-presets";
import { getDictionary, hasLocale } from "@/lib/dictionaries";
import { fontPairCssVars } from "@/lib/fonts";
import { resolveTenant } from "@/lib/tenant";

// Tenant chrome: resolves the tenant from the request Host and applies its
// brand preset + font pair as CSS custom properties. Pages below use
// var(--brand-accent); headings opt into var(--font-heading).

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const tenant = await resolveTenant().catch(() => null);
  const vars = {
    ...brandCssVars(tenant?.theme.presetKey),
    ...fontPairCssVars(tenant?.theme.fontPairKey),
  };

  return (
    <div
      style={{ ...vars, fontFamily: "var(--font-body, inherit)" }}
      className="min-h-dvh"
    >
      <SessionBar lang={lang} dict={dict} />
      {tenant && !tenant.flags.platform ? (
        <TenantHeader tenant={tenant} dict={dict} lang={lang} />
      ) : null}
      {children}
    </div>
  );
}
