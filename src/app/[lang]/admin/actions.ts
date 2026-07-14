"use server";

import { redirect } from "next/navigation";
import { createBlockout, releaseBlockout } from "@/lib/admin/blockouts";
import { updateTenantDesign } from "@/lib/admin/design";
import { getStaffContext, type StaffContext } from "@/lib/admin/guard";
import { createRateOverride, deleteRateOverride } from "@/lib/admin/pricing";
import {
  transitionReservation,
  type ReservationAction,
} from "@/lib/admin/reservations";
import { addDays } from "@/lib/booking/dates";
import { SECTION_KEYS } from "@/lib/sections";
import type { TenantRole } from "@/db/schema";

// Every action re-guards independently of the page (a stale tab must not
// outlive a revoked membership) and reports back via ?ok/?error redirect
// flags rendered with role=status/alert.

async function guardOr403(min: TenantRole, lang: string): Promise<StaffContext> {
  const gate = await getStaffContext(min);
  if (!gate.ok) redirect(`/${lang}/sign-in`);
  return gate.ctx;
}

function backTo(path: string, flag: "ok" | "error", value: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${flag}=${encodeURIComponent(value)}`);
}

export async function reservationAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = String(formData.get("back") ?? `/${lang}/admin/reservations`);
  const ctx = await guardOr403("front_desk", lang);
  const result = await transitionReservation(
    ctx.tenant.id,
    String(formData.get("reservationId") ?? ""),
    String(formData.get("action") ?? "") as ReservationAction,
  );
  if (!result.ok) backTo(back, "error", result.code);
  backTo(back, "ok", "1");
}

export async function blockUnitAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = String(formData.get("back") ?? `/${lang}/admin/calendar`);
  const ctx = await guardOr403("front_desk", lang);
  const date = String(formData.get("date") ?? "");
  const result = await createBlockout({
    tenantId: ctx.tenant.id,
    unitId: String(formData.get("unitId") ?? ""),
    startDate: date,
    endDate: addDays(date, 1),
    reason: String(formData.get("reason") ?? "") || undefined,
    createdBy: ctx.user.id,
  });
  if (!result.ok) backTo(back, "error", result.code);
  backTo(back, "ok", "1");
}

export async function unblockUnitAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = String(formData.get("back") ?? `/${lang}/admin/calendar`);
  const ctx = await guardOr403("front_desk", lang);
  const result = await releaseBlockout(
    ctx.tenant.id,
    String(formData.get("claimId") ?? ""),
  );
  if (!result.ok) backTo(back, "error", result.code);
  backTo(back, "ok", "1");
}

export async function createOverrideAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = String(formData.get("back") ?? `/${lang}/admin/pricing`);
  const ctx = await guardOr403("manager", lang);

  let dowMask = 0;
  for (let bit = 0; bit < 7; bit++) {
    if (formData.get(`dow${bit}`)) dowMask |= 1 << bit;
  }
  const result = await createRateOverride({
    tenantId: ctx.tenant.id,
    roomTypeId: String(formData.get("roomTypeId") ?? ""),
    label: String(formData.get("label") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    rateMinor: Number(formData.get("rateMinor") ?? NaN),
    priority: Number(formData.get("priority") ?? 0),
    dowMask: dowMask === 0 ? null : dowMask,
  });
  if (!result.ok) backTo(back, "error", result.code);
  backTo(back, "ok", "1");
}

export async function deleteOverrideAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = String(formData.get("back") ?? `/${lang}/admin/pricing`);
  const ctx = await guardOr403("manager", lang);
  await deleteRateOverride(ctx.tenant.id, String(formData.get("overrideId") ?? ""));
  backTo(back, "ok", "1");
}

export async function saveDesignAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = `/${lang}/admin/design`;
  const ctx = await guardOr403("manager", lang);

  const positions: { key: string; pos: number }[] = [];
  const hidden: string[] = [];
  const variants: Record<string, string> = {};
  for (const key of SECTION_KEYS) {
    positions.push({ key, pos: Number(formData.get(`order_${key}`) ?? 99) });
    if (key !== "hero" && !formData.get(`visible_${key}`)) hidden.push(key);
    const variant = formData.get(`variant_${key}`);
    if (variant) variants[key] = String(variant);
  }
  positions.sort((a, b) => a.pos - b.pos);

  const result = await updateTenantDesign(ctx.tenant.id, {
    presetKey: String(formData.get("presetKey") ?? ""),
    fontPairKey: String(formData.get("fontPairKey") ?? ""),
    sectionOrder: positions.map((p) => p.key),
    sectionHidden: hidden,
    sectionVariants: variants,
  });
  if (!result.ok) backTo(back, "error", result.code);
  backTo(back, "ok", "saved");
}
