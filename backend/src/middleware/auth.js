const jwt = require("jsonwebtoken");
const { pool } = require("../db");

// Every protected route needs a valid token. The token payload only ever
// contains { id, role, year, branch, isVerified } — never email or any
// other personally identifying field, so even a decoded token leaks the
// minimum possible if it's ever logged by accident.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

// Only verified seniors can answer questions. "Verified" is a manual admin
// flag for now — see README "Senior verification" for how to wire up a real
// verification flow (ID upload, transcript check, etc.) before launch.
//
// This checks the DATABASE, not the JWT payload: is_verified can change
// after a user's token was issued (an admin approves them later), and a
// 30-day token shouldn't be able to cache a stale "not verified yet" or,
// worse, a stale "verified" if that's ever revoked.
async function requireVerifiedSenior(req, res, next) {
  if (req.user.role !== "senior") {
    return res.status(403).json({ error: "Only seniors can answer questions." });
  }
  try {
    const result = await pool.query("SELECT is_verified FROM users WHERE id = $1", [req.user.id]);
    if (!result.rows[0] || !result.rows[0].is_verified) {
      return res.status(403).json({ error: "Your senior account isn't verified yet." });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not verify your account." });
  }
}

module.exports = { requireAuth, requireVerifiedSenior };
