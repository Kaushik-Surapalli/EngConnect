const jwt = require("jsonwebtoken");

function signToken(user) {
  // Deliberately minimal payload — see middleware/auth.js for why.
  return jwt.sign(
    { id: user.id, role: user.role, year: user.year, branch: user.branch, isVerified: user.is_verified },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

module.exports = { signToken };
