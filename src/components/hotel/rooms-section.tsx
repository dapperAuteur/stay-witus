import Link from "next/link";
import type { roomTypes } from "@/db/schema";
import type { Dictionary } from "@/lib/dictionaries";
import { formatMoneyMinor } from "@/lib/money";
import type { RoomPhoto } from "@/lib/rooms";
import { SectionShell } from "./section-shell";

type RoomTypeRow = typeof roomTypes.$inferSelect;

/** Variants: "grid" (cards) and "list" (stacked rows). */
export function RoomsSection({
  rooms,
  variant,
  dict,
  lang,
  thumbnails,
}: {
  rooms: RoomTypeRow[];
  variant: string;
  dict: Dictionary;
  lang: string;
  thumbnails: Map<string, RoomPhoto>;
}) {
  if (rooms.length === 0) return null;
  const s = dict.sections;

  return (
    <SectionShell id="rooms" title={s.roomsTitle}>
      <ul
        className={
          variant === "list"
            ? "flex flex-col gap-4"
            : "grid gap-4 sm:grid-cols-2"
        }
      >
        {rooms.map((room) => (
          <li
            key={room.id}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
          >
            {thumbnails.get(room.id) ? (
              <Link href={`/${lang}/rooms/${room.slug}`} tabIndex={-1} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary f_auto/q_auto */}
                <img
                  src={thumbnails.get(room.id)?.url}
                  alt=""
                  className="h-44 w-full object-cover"
                />
              </Link>
            ) : null}
            <div className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold [font-family:var(--font-heading)]">
                <Link
                  href={`/${lang}/rooms/${room.slug}`}
                  className="underline-offset-4 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {room.name}
                </Link>
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {s.roomsFrom}{" "}
                <span
                  className="text-base font-semibold"
                  style={{ color: "var(--brand-accent)" }}
                >
                  {formatMoneyMinor(room.baseRateMinor, room.currency)}
                </span>{" "}
                {s.roomsPerNight}
              </p>
            </div>
            {room.description ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {room.description}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
              {s.roomsSleeps} {room.maxOccupancy}
              {room.bedConfig ? <> · {room.bedConfig}</> : null}
              {room.sizeSqm ? <> · {room.sizeSqm} m²</> : null}
            </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
