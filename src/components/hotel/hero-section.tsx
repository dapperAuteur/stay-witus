import type { TenantRecord } from "@/lib/tenant";
import type { Dictionary } from "@/lib/dictionaries";
import type { siteSections } from "@/db/schema";
import { Paragraphs } from "./paragraphs";

type SiteSectionRow = typeof siteSections.$inferSelect;

/**
 * Variants: "image" (full-bleed photo when the owner has set one) and
 * "minimal" (type-only). Carousel/video variants land with the media
 * workstream. Falls back to minimal when no image exists yet.
 */
export function HeroSection({
  tenant,
  row,
  variant,
  dict,
}: {
  tenant: TenantRecord;
  row: SiteSectionRow | undefined;
  variant: string;
  dict: Dictionary;
}) {
  const name = row?.title ?? tenant.theme.name ?? tenant.name;
  const data = (row?.data ?? {}) as { imageUrl?: string; imageAlt?: string };
  const showImage = variant === "image" && Boolean(data.imageUrl);

  return (
    <header className="relative">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- owner-hosted URL, dimensions unknown until the media workstream
        <img
          src={data.imageUrl}
          alt={data.imageAlt ?? ""}
          className="h-64 w-full rounded-2xl object-cover sm:h-80"
        />
      ) : null}
      <div className={showImage ? "mt-6" : "pt-4"}>
        <h1 className="text-4xl font-bold leading-tight [font-family:var(--font-heading)] sm:text-5xl">
          {name}
        </h1>
        {tenant.tagline ? (
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            {tenant.tagline}
          </p>
        ) : null}
        {row?.body ? (
          <div className="mt-4 max-w-2xl">
            <Paragraphs text={row.body} />
          </div>
        ) : null}
        <a
          href="#rooms"
          className="mt-6 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          style={{
            background: "var(--brand-accent)",
            color: "var(--brand-accent-fg)",
          }}
        >
          {dict.home.searchRooms}
        </a>
      </div>
    </header>
  );
}
