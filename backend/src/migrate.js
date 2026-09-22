// Applies schema.sql to the database pointed at by DATABASE_URL.
// Usage: npm run migrate
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in first.");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  console.log("Applying schema.sql ...");
  await pool.query(sql);
  console.log("Done. Tables created/updated and demo opportunities + experiences seeded.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
