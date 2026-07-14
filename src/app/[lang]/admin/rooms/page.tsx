import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/admin/guard";
import { hasCloudinary } from "@/lib/media/cloudinary";
import { listRoomTypesWithPhotos } from "@/lib/rooms";
import { getDictionary, hasLocale } from "@/lib/dictionaries";
import { PhotoUpload } from "@/components/photo-upload";
import { removeRoomPhotoAction, updateRoomTypeAction } from "../actions";
import { Flash } from "../flash";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rooms" };

const INPUT =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900";

export default async function AdminRoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const ctx = await requireStaffPage("manager", lang);
  const a = dict.admin.rooms;
  const sp = await searchParams;
  const rows = await listRoomTypesWithPhotos(ctx.tenant.id);
  const mediaReady = hasCloudinary();

  return (
    <div>
      <Flash ok={sp.ok} error={sp.error} dict={dict} />
      <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">{a.intro}</p>
      {!mediaReady ? (
        <p className="mt-2 max-w-xl text-xs text-slate-500">{a.mediaPending}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{a.empty}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6">
          {rows.map((room) => (
            <li key={room.id} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <form action={updateRoomTypeAction} className="flex flex-col gap-4">
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="roomTypeId" value={room.id} />
                <div className="flex flex-wrap gap-4">
                  <div className="flex min-w-56 flex-1 flex-col gap-1">
                    <label htmlFor={`${room.id}-name`} className="text-sm font-medium">{a.nameField}</label>
                    <input id={`${room.id}-name`} name="name" required defaultValue={room.name} className={INPUT} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${room.id}-rate`} className="text-sm font-medium">{a.rateField}</label>
                    <input id={`${room.id}-rate`} name="baseRateMinor" type="number" min={1} defaultValue={room.baseRateMinor} className={`${INPUT} w-32`} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${room.id}-occ`} className="text-sm font-medium">{a.occupancyField}</label>
                    <input id={`${room.id}-occ`} name="maxOccupancy" type="number" min={1} max={12} defaultValue={room.maxOccupancy} className={`${INPUT} w-20`} />
                  </div>
                  <div className="flex min-w-40 flex-col gap-1">
                    <label htmlFor={`${room.id}-beds`} className="text-sm font-medium">{a.bedsField}</label>
                    <input id={`${room.id}-beds`} name="bedConfig" defaultValue={room.bedConfig ?? ""} className={INPUT} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${room.id}-size`} className="text-sm font-medium">{a.sizeField}</label>
                    <input id={`${room.id}-size`} name="sizeSqm" type="number" min={1} defaultValue={room.sizeSqm ?? ""} className={`${INPUT} w-20`} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${room.id}-sort`} className="text-sm font-medium">{a.sortField}</label>
                    <input id={`${room.id}-sort`} name="sortOrder" type="number" defaultValue={room.sortOrder} className={`${INPUT} w-20`} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${room.id}-desc`} className="text-sm font-medium">{a.descriptionField}</label>
                  <textarea id={`${room.id}-desc`} name="description" rows={2} defaultValue={room.description ?? ""} className="rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="isActive" value="1" defaultChecked={room.isActive} className="h-4 w-4" />
                    {a.activeField}
                  </label>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    style={{ background: "var(--brand-accent)", color: "var(--brand-accent-fg)" }}
                  >
                    {a.save}
                    <span className="sr-only"> {room.name}</span>
                  </button>
                </div>
              </form>

              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                {room.photos.length > 0 ? (
                  <ul className="flex flex-wrap gap-3">
                    {room.photos.map((photo) => (
                      <li key={photo.photoId} className="flex flex-col gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers optimized f_auto/q_auto */}
                        <img src={photo.url} alt={photo.alt} className="h-24 w-36 rounded-lg object-cover" />
                        <form action={removeRoomPhotoAction}>
                          <input type="hidden" name="lang" value={lang} />
                          <input type="hidden" name="photoId" value={photo.photoId} />
                          <button type="submit" className="inline-flex min-h-11 items-center text-xs underline underline-offset-4">
                            {a.removePhoto}
                            <span className="sr-only"> {photo.alt || room.name}</span>
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {mediaReady ? (
                  <div className="mt-3 max-w-md">
                    <PhotoUpload
                      roomTypeId={room.id}
                      labels={{
                        photoField: a.photoField,
                        altField: a.altField,
                        decorative: a.decorative,
                        upload: a.upload,
                        uploading: a.uploading,
                        done: a.uploadDone,
                        failed: a.uploadFailed,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
