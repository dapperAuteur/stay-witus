import type { siteSections } from "@/db/schema";
import { Paragraphs } from "./paragraphs";
import { SectionShell } from "./section-shell";

type SiteSectionRow = typeof siteSections.$inferSelect;

/** about + dining v1: an owner-written title/body block. Null until published. */
export function TextSection({
  id,
  fallbackTitle,
  row,
}: {
  id: string;
  fallbackTitle: string;
  row: SiteSectionRow | undefined;
}) {
  if (!row?.body) return null;
  return (
    <SectionShell id={id} title={row.title ?? fallbackTitle}>
      <div className="max-w-2xl">
        <Paragraphs text={row.body} />
      </div>
    </SectionShell>
  );
}
