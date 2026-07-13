import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attractions,
  events,
  hotelSettings,
  partners,
  roomTypes,
  siteSections,
} from "@/db/schema";
import type { Dictionary } from "@/lib/dictionaries";
import { resolveSectionConfig, type SectionKey } from "@/lib/sections";
import type { TenantRecord } from "@/lib/tenant";
import { ConciergeSection } from "./concierge-section";
import { ContactSection } from "./contact-section";
import { EventsSection } from "./events-section";
import { GuideSection } from "./guide-section";
import { HeroSection } from "./hero-section";
import { RoomsSection } from "./rooms-section";
import { TourSection } from "./tour-section";
import { TextSection } from "./text-section";

// The rung-2 renderer: sections draw in the owner's order, hidden ones never
// query. Every word inside comes from owner-written rows or the reviewed
// dictionary — no generated prose reaches guests (ecosystem rule).

/** Section key → site_sections.key (schema uses virtual_tour). */
const SITE_SECTION_KEYS: Partial<Record<SectionKey, string>> = {
  hero: "hero",
  about: "about",
  dining: "dining",
  tour: "virtual_tour",
};

export async function HotelHome({
  tenant,
  dict,
  lang,
}: {
  tenant: TenantRecord;
  dict: Dictionary;
  lang: string;
}) {
  const config = resolveSectionConfig(tenant.theme, tenant.flags);
  const need = new Set(config.order);

  const wantedSiteKeys = config.order
    .map((key) => SITE_SECTION_KEYS[key])
    .filter((key): key is string => Boolean(key));

  const [sectionRows, rooms, upcoming, approved, spots, settingsRows] =
    await Promise.all([
      wantedSiteKeys.length > 0
        ? db()
            .select()
            .from(siteSections)
            .where(
              and(
                eq(siteSections.tenantId, tenant.id),
                eq(siteSections.isPublished, true),
                inArray(siteSections.key, wantedSiteKeys),
              ),
            )
        : [],
      need.has("rooms")
        ? db()
            .select()
            .from(roomTypes)
            .where(
              and(eq(roomTypes.tenantId, tenant.id), eq(roomTypes.isActive, true)),
            )
            .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.name))
        : [],
      need.has("events")
        ? db()
            .select()
            .from(events)
            .where(
              and(
                eq(events.tenantId, tenant.id),
                eq(events.isPublished, true),
                gte(events.startsAt, new Date()),
              ),
            )
            .orderBy(asc(events.startsAt))
            .limit(3)
        : [],
      need.has("concierge")
        ? db()
            .select()
            .from(partners)
            .where(
              and(
                eq(partners.tenantId, tenant.id),
                eq(partners.status, "approved"),
              ),
            )
            .orderBy(asc(partners.sortOrder), asc(partners.name))
            .limit(6)
        : [],
      need.has("guide")
        ? db()
            .select()
            .from(attractions)
            .where(
              and(
                eq(attractions.tenantId, tenant.id),
                eq(attractions.isPublished, true),
              ),
            )
            .orderBy(asc(attractions.sortOrder), asc(attractions.name))
            .limit(6)
        : [],
      db()
        .select()
        .from(hotelSettings)
        .where(eq(hotelSettings.tenantId, tenant.id))
        .limit(1),
    ]);

  const byKey = new Map(sectionRows.map((row) => [row.key, row]));
  const settings = settingsRows[0];
  const timezone = settings?.timezone ?? "Africa/Accra";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {config.order.map((key) => {
        switch (key) {
          case "hero":
            return (
              <HeroSection
                key={key}
                tenant={tenant}
                row={byKey.get("hero")}
                variant={config.variants.hero}
                dict={dict}
                lang={lang}
              />
            );
          case "about":
            return (
              <TextSection
                key={key}
                id="about"
                fallbackTitle={dict.sections.aboutTitle}
                row={byKey.get("about")}
              />
            );
          case "rooms":
            return (
              <RoomsSection
                key={key}
                rooms={rooms}
                variant={config.variants.rooms}
                dict={dict}
              />
            );
          case "dining":
            return (
              <TextSection
                key={key}
                id="dining"
                fallbackTitle={dict.sections.diningTitle}
                row={byKey.get("dining")}
              />
            );
          case "events":
            return (
              <EventsSection
                key={key}
                upcoming={upcoming}
                timezone={timezone}
                dict={dict}
              />
            );
          case "concierge":
            return <ConciergeSection key={key} approved={approved} dict={dict} />;
          case "guide":
            return <GuideSection key={key} published={spots} dict={dict} />;
          case "tour":
            return (
              <TourSection key={key} row={byKey.get("virtual_tour")} dict={dict} />
            );
          case "contact":
            return <ContactSection key={key} settings={settings} dict={dict} />;
        }
      })}
    </main>
  );
}
