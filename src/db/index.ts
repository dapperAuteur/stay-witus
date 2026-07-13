import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { env } from "@/lib/env";

let _db: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Lazy singleton so importing modules never crashes a build without
 * DATABASE_URL. Callers that can render without a DB (e.g. the setup
 * fallback page) check `hasDatabase` first.
 */
export function db(): NeonHttpDatabase<typeof schema> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!_db) {
    _db = drizzle(neon(env.DATABASE_URL), { schema });
  }
  return _db;
}

export { schema };
