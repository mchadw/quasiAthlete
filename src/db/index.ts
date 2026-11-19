import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import pg from "pg";
import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

interface GlobalDbCache {
  dbPromise?: Promise<AppDatabase>;
  pool?: pg.Pool;
  pglite?: PGlite;
  mode?: "postgres" | "pglite";
}

const globalForDb = globalThis as unknown as { __quasiAthleteDb?: GlobalDbCache };
const cache: GlobalDbCache = (globalForDb.__quasiAthleteDb ??= {});

async function applyMigrationsToPglite(client: PGlite) {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlText = await readFile(path.join(migrationsDir, file), "utf8");
    await client.exec(sqlText);
  }
}

async function initDb(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

  if (databaseUrl !== "") {
    cache.mode = "postgres";
    cache.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return drizzlePg(cache.pool, { schema });
  }

  // Zero-setup local PostgreSQL via embedded PGlite (WASM Postgres 16)
  cache.mode = "pglite";
  const client = new PGlite();
  await client.waitReady;
  await applyMigrationsToPglite(client);
  cache.pglite = client;
  return drizzlePglite(client, { schema }) as unknown as AppDatabase;
}

/**
 * Returns a Drizzle ORM Postgres database instance:
 * - Uses real Postgres (`pg.Pool`) when DATABASE_URL is set (Cursor Apps or local Postgres).
 * - Automatically falls back to embedded PGlite Postgres when DATABASE_URL is unset.
 */
export async function getDb(): Promise<AppDatabase> {
  cache.dbPromise ??= initDb().catch((err) => {
    cache.dbPromise = undefined;
    throw err;
  });
  return cache.dbPromise;
}

export function getDbEngineMode(): "postgres" | "pglite" {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "pglite";
}
