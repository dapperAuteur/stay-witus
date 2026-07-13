import type { roomTypes } from "@/db/schema";
import type { Dictionary } from "@/lib/dictionaries";
import { formatMoneyMinor } from "@/lib/money";
import { SectionShell } from "./section-shell";

type RoomTypeRow = typeof roomTypes.$inferSelect;

/** Variants: "grid" (cards) and "list" (stacked rows). */
export function RoomsSection({
  rooms,
  variant,
  dict,
}: {
  rooms: RoomTypeRow[];
  variant: string;
  dict: Dictionary;
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
            className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold [font-family:var(--font-heading)]">
                {room.name}
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
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
