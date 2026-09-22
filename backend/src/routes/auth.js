const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { signToken } = require("../utils/token");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"];

router.post("/register", async (req, res) => {
  const { email, password, year, branch, role } = req.body || {};
  if (!email || !password || !year || !branch) {
    return res.status(400).json({ error: "email, password, year and branch are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (!BRANCHES.includes(branch)) {
    return res.status(400).json({ error: `branch must be one of ${BRANCHES.join(", ")}` });
  }
  const y = Number(year);
  if (![1, 2, 3, 4].includes(y)) return res.status(400).json({ error: "year must be 1-4." });

  const wantsSenior = role === "senior";
  if (wantsSenior && y < 3) {
    return res.status(400).json({ error: "Only 3rd/4th year students can register as seniors." });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rows.length) return res.status(409).json({ error: "An account with this email already exists." });

    const hash = await bcrypt.hash(password, 10);
    // Seniors start unverified — see README "Senior verification" for how
    // to turn this into a real approval workflow before going live.
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, year, branch, role, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, email, year, branch, role, is_verified`,
      [email.toLowerCase().trim(), hash, y, branch, wantsSenior ? "senior" : "student", wantsSenior ? false : true]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required." });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password." });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, year, branch, role, is_verified FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load profile." });
  }
});

// Returns a user's OWN profile to THEMSELVES only — this route is never
// used to look up another user, and no route in this app exposes another
// user's email. That boundary is what keeps both sides of Q&A anonymous.
function publicUser(u) {
  return { id: u.id, email: u.email, year: u.year, branch: u.branch, role: u.role, isVerified: u.is_verified };
}

module.exports = router;
