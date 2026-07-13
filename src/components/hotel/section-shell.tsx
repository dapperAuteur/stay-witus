/** Consistent landmark + heading chrome for every homepage section. */
export function SectionShell({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="mt-14">
      <h2
        id={headingId}
        className="text-2xl font-bold [font-family:var(--font-heading)]"
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
