require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { pool } = require("./db");

const authRoutes = require("./routes/auth");
const questionRoutes = require("./routes/questions");
const answerRoutes = require("./routes/answers");
const miscRoutes = require("./routes/misc");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "engconnect-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api", miscRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set.");
    }

    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log("Applying database schema...");
    await pool.query(schema);
    console.log("Database schema ready.");

    app.listen(PORT, () => {
      console.log(`EngConnect API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  }
}

startServer();