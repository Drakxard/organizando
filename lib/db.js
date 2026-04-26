const fs = require("node:fs");
const path = require("node:path");
const postgres = require("postgres");

let sqlClient;

loadLocalEnv();

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getSql() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    const error = new Error("DATABASE_URL no esta configurada.");
    error.statusCode = 500;
    throw error;
  }

  if (!sqlClient) {
    sqlClient = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15
    });
  }

  return sqlClient;
}

async function initializeSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      theme TEXT NOT NULL,
      palette TEXT NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sort_order BIGINT
    )
  `;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS background_color TEXT`;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS progress_color TEXT`;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS text_color TEXT`;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS sort_order BIGINT`;
  await sql`
    WITH ranked_events AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id ASC) - 1 AS next_sort_order
      FROM events
    )
    UPDATE events
    SET sort_order = ranked_events.next_sort_order
    FROM ranked_events
    WHERE events.id = ranked_events.id
      AND events.sort_order IS NULL
  `;
  await sql`ALTER TABLE events ALTER COLUMN sort_order SET NOT NULL`;
}

module.exports = {
  getSql,
  initializeSchema
};
