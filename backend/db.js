require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Create backend/.env with your Neon connection string (see .env.example).");
  process.exit(1);
}

// Drop sslmode / channel_binding from the URL so the explicit ssl option below is used by node-postgres
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
url.searchParams.delete("channel_binding");

const pool = new Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true }, // Neon requires SSL
});

pool.on("error", (err) => console.error("Unexpected database error:", err.message));

// Only checks the connection. The tables already exist in Neon and are never created or altered here.
pool.init = async function () {
  try {
    await pool.query("SELECT 1");
    console.log("Neon PostgreSQL connected successfully!");
  } catch (err) {
    console.error("Database error:", err.message);
    console.error("-> Check DATABASE_URL in backend/.env and that your Neon project is active.");
  }
};

module.exports = pool;
