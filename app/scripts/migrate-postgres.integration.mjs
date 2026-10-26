// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.trim()) {
  throw new Error("migration-postgres-integration-requires-DATABASE_URL");
}

const suffix = randomUUID().replaceAll("-", "");
const successTable = "nk1_ci_migration_success_" + suffix;
const rollbackTable = "nk1_ci_migration_rollback_" + suffix;
const successMigration = "9999_ci_success_" + suffix + ".sql";
const rollbackMigration = "9998_ci_rollback_" + suffix + ".sql";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(scriptDirectory, "..", "migrations");
const migratorPath = join(scriptDirectory, "migrate.mjs");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

/** @param {boolean} expectSuccess */
function runMigrator(expectSuccess) {
  const result = spawnSync(process.execPath, [migratorPath], {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.error) throw result.error;
  if (expectSuccess) {
    assert.equal(
      result.status,
      0,
      "migrator should succeed: " + String(result.stdout).slice(-2000) + String(result.stderr).slice(-4000),
    );
  } else {
    assert.notEqual(result.status, 0, "deliberately invalid migration must fail");
    assert.match(
      String(result.stderr),
      /error applying 9998_ci_rollback_|failed:/,
      "failure should identify the migration and preserve the original database error",
    );
  }
  return result;
}

/** @param {string} table */
async function tableExists(table) {
  const result = await pool.query("SELECT to_regclass($1) AS name", ["public." + table]);
  return result.rows[0]?.name !== null && result.rows[0]?.name !== undefined;
}

/** @param {string} name */
async function migrationRecorded(name) {
  const result = await pool.query("SELECT count(*)::int AS count FROM _migrations WHERE name = $1", [name]);
  return result.rows[0]?.count ?? 0;
}

let successFileWritten = false;
let rollbackFileWritten = false;
try {
  await writeFile(
    join(migrationsDirectory, successMigration),
    "CREATE TABLE public." + successTable + " (id integer PRIMARY KEY);\n" +
      "INSERT INTO public." + successTable + " (id) VALUES (1);\n",
    { flag: "wx", mode: 0o600 },
  );
  successFileWritten = true;

  const first = runMigrator(true);
  assert.ok(first.stdout.includes("applied " + successMigration), "first run must log the applied migration");
  assert.equal(await tableExists(successTable), true, "first run must create the test table");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM public." + successTable)).rows[0].count, 1);
  assert.equal(await migrationRecorded(successMigration), 1, "successful migration must be recorded once");

  runMigrator(true);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM public." + successTable)).rows[0].count, 1,
    "a second migrator run must not reapply a successful migration");
  assert.equal(await migrationRecorded(successMigration), 1, "rerun must not duplicate ledger entries");

  await writeFile(
    join(migrationsDirectory, rollbackMigration),
    "CREATE TABLE public." + rollbackTable + " (id integer PRIMARY KEY);\n" +
      "INSERT INTO public." + rollbackTable + " (id) VALUES (1);\n" +
      "THIS IS INTENTIONALLY INVALID SQL;\n",
    { flag: "wx", mode: 0o600 },
  );
  rollbackFileWritten = true;

  runMigrator(false);
  assert.equal(await tableExists(rollbackTable), false,
    "DDL executed before a migration error must be rolled back with the transaction");
  assert.equal(await migrationRecorded(rollbackMigration), 0,
    "failed migration must never be recorded as applied");
  assert.equal(await tableExists(successTable), true, "a failed later migration must not damage an earlier successful one");
  assert.equal(await migrationRecorded(successMigration), 1);
  console.log("WORKPASS365_POSTGRES_MIGRATION=PASS apply=1 rerun=idempotent rollback=atomic");
} finally {
  if (rollbackFileWritten) await rm(join(migrationsDirectory, rollbackMigration), { force: true });
  if (successFileWritten) await rm(join(migrationsDirectory, successMigration), { force: true });
  try {
    try {
      await pool.query("DELETE FROM _migrations WHERE name = ANY($1::text[])", [[successMigration, rollbackMigration]]);
    } catch {
      // If the initial connection never created the ledger, cleanup is a no-op.
    }
    await pool.query("DROP TABLE IF EXISTS public." + rollbackTable);
    await pool.query("DROP TABLE IF EXISTS public." + successTable);
  } finally {
    await pool.end();
  }
}
