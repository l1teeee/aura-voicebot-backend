import pg from 'pg'

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('Falta DATABASE_URL en el entorno.')
  process.exit(1)
}

const schema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(40) NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  name_key VARCHAR(40) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorite_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  city_key TEXT NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  units TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, city_key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_started_at_idx
  ON sessions (user_id, started_at);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  bot_reply TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interactions_session_id_created_at_idx
  ON interactions (session_id, created_at);
`

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
})

try {
  await client.connect()
  await client.query(schema)
  console.log('Migracion aplicada correctamente.\n')

  const result = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'favorite_cities'
     ORDER BY ordinal_position`
  )
  console.table(result.rows)
} catch (error) {
  console.error('Fallo la migracion:')
  console.error(error)
  process.exitCode = 1
} finally {
  await client.end()
}
