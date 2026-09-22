const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("[engconnect] WARNING: DATABASE_URL is not set. The API will fail on first query.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most hosted Postgres providers (Render, Railway, Neon, Supabase) require
  // SSL and use certs that Node won't validate by default. Localhost doesn't
  // need SSL at all.
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = { pool };
