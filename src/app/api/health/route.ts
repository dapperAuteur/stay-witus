import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Uptime probe for the Better Stack monitors. The homepage can serve a cached
// 200 while the database is down, so a monitor pointed at "/" stays green
// through an outage. This route answers exactly one question: is this
// deployment running AND can it round-trip a real query to its database? So a
// green check means something.
//
// Four deliberate choices, each load-bearing:
//
// 1. NOT the {ok:true,data} Result envelope the rest of the API uses. The shape
//    here is a monitoring contract parsed by an external tool, so it is a flat
//    fixed literal: {"ok":true,"checks":{"db":"ok"}} / {"ok":false,
//    "error":"database_unreachable"}. Changing it breaks the monitor.
//
// 2. Tenant-agnostic. It never resolves a tenant from the host (no
//    src/lib/tenant.ts import) and never reads a tenant, hotel, room, booking,
//    or guest row. `select 1` touches no table, so the answer is identical on
//    every domain and a hotel with zero rows is still "up". This app holds
//    guest names, phone numbers, addresses, and payment references: the
//    response body must never carry a row, a count, or anything implying volume.
//
// 3. No third-party calls. Paystack, Mailgun, and Cloudinary are deliberately
//    NOT checked: a payment-vendor outage must not turn the uptime monitor red,
//    and vendor errors carry tokens.
//
// 4. Never echoes an error. See the bare catch below.

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Long enough for a cold Neon connection, short enough to beat the monitor's own timeout. */
const TIMEOUT_MS = 4_000;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

/**
 * Cheapest possible liveness query. True only if `select 1` actually came back
 * from Postgres within the budget: a missing DATABASE_URL (db() throws), a
 * refused connection, and a hung socket all read as false.
 */
async function databaseIsLive(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const probe = (async () => {
      await db().execute(sql`select 1`);
    })();
    // The loser of the race is never awaited; swallow it so a late driver
    // rejection cannot surface as an unhandled rejection.
    probe.catch(() => {});
    const budget = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("health probe timeout")), TIMEOUT_MS);
    });
    await Promise.race([probe, budget]);
    return true;
  } catch {
    // Bare catch, no binding, on purpose. A driver error can carry the
    // connection string (credentials), the host, or a query fragment, and the
    // log sink is as readable as the response body, so log a CONSTANT string.
    // Never `err.message`, never the error object, never a template with it.
    console.error("[health] database liveness check failed");
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const live = await databaseIsLive();
  return live
    ? NextResponse.json({ ok: true, checks: { db: "ok" } }, { status: 200, headers: NO_STORE })
    : NextResponse.json(
        { ok: false, error: "database_unreachable" },
        { status: 503, headers: NO_STORE },
      );
}

/** Monitors that probe with HEAD get the same verdict without a body. */
export async function HEAD() {
  const live = await databaseIsLive();
  return new Response(null, { status: live ? 200 : 503, headers: NO_STORE });
}
