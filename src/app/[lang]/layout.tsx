import { notFound } from "next/navigation";
import { brandCssVars } from "@/lib/brand-presets";
import { hasLocale } from "@/lib/dictionaries";
import { resolveTenant } from "@/lib/tenant";

// Tenant chrome: resolves the tenant from the request Host and applies its
// brand preset as CSS custom properties. Pages below use var(--brand-accent).

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const tenant = await resolveTenant().catch(() => null);
  const vars = brandCssVars(tenant?.theme.presetKey);

  return (
    <div style={vars} className="min-h-dvh">
      {children}
    </div>
  );
}
