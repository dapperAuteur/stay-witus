"use server";

import { redirect } from "next/navigation";
import { platformAccess } from "@/lib/platform/guard";
import {
  createTenant,
  EDITABLE_FLAGS,
  updateTenantAdmin,
  type EditableFlag,
} from "@/lib/platform/tenants";

async function guard(lang: string): Promise<void> {
  const access = await platformAccess();
  if (!access.ok) redirect(`/${lang}/sign-in`);
}

export async function createTenantAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = `/${lang}/platform/tenants`;
  await guard(lang);
  const result = await createTenant(
    String(formData.get("slug") ?? ""),
    String(formData.get("name") ?? ""),
  );
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.code)}`);
  redirect(`${back}?ok=1`);
}

export async function updateTenantAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const back = `/${lang}/platform/tenants`;
  await guard(lang);
  const flags: Partial<Record<EditableFlag, boolean>> = {};
  for (const flag of EDITABLE_FLAGS) {
    flags[flag] = Boolean(formData.get(`flag_${flag}`));
  }
  const result = await updateTenantAdmin(String(formData.get("tenantId") ?? ""), {
    name: String(formData.get("name") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    isActive: Boolean(formData.get("isActive")),
    flags,
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.code)}`);
  redirect(`${back}?ok=1`);
}
