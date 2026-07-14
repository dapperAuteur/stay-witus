import Link from "next/link";
import type { events } from "@/db/schema";
import type { Dictionary } from "@/lib/dictionaries";
import { SectionShell } from "./section-shell";

type EventRow = typeof events.$inferSelect;

export function EventsSection({
  upcoming,
  timezone,
  dict,
  lang,
}: {
  upcoming: EventRow[];
  timezone: string;
  dict: Dictionary;
  lang: string;
}) {
  if (upcoming.length === 0) return null;
  const formatter = new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });

  return (
    <SectionShell id="events" title={dict.sections.eventsTitle}>
      <ul className="flex flex-col gap-4">
        {upcoming.map((event) => (
          <li
            key={event.id}
            className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
          >
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--brand-accent)" }}
            >
              <time dateTime={event.startsAt.toISOString()}>
                {formatter.format(event.startsAt)}
              </time>
            </p>
            <h3 className="mt-1 text-lg font-semibold [font-family:var(--font-heading)]">
              {event.title}
            </h3>
            {event.locationText ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                {event.locationText}
              </p>
            ) : null}
            {event.description ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {event.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-4">
        <Link
          href={`/${lang}/events`}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.events.rsvpTitle} →
        </Link>
      </p>
    </SectionShell>
  );
}
