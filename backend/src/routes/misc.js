const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/opportunities?branch=CSE&year=2&skill=SQL&type=Internship
router.get("/opportunities", requireAuth, async (req, res) => {
  const { branch, year, skill, type } = req.query;
  try {
    const clauses = [];
    const values = [];
    if (branch && branch !== "All") { values.push(branch); clauses.push(`$${values.length} = ANY(branch)`); }
    if (year && year !== "All") { values.push(Number(year)); clauses.push(`$${values.length} = ANY(year)`); }
    if (type && type !== "All") { values.push(type); clauses.push(`type = $${values.length}`); }
    if (skill) { values.push(`%${skill.toLowerCase()}%`); clauses.push(`EXISTS (SELECT 1 FROM unnest(skills) s WHERE lower(s) LIKE $${values.length})`); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM opportunities ${where} ORDER BY id`, values);
    res.json({ opportunities: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load opportunities." });
  }
});

// GET /api/experiences?category=Internships
router.get("/experiences", requireAuth, async (req, res) => {
  try {
    const { category } = req.query;
    const result = category && category !== "All"
      ? await pool.query("SELECT branch, year, topic, category FROM experiences WHERE category = $1 ORDER BY id", [category])
      : await pool.query("SELECT branch, year, topic, category FROM experiences ORDER BY id");
    res.json({ experiences: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load experiences." });
  }
});

// POST /api/roadmap — rule-based for the prototype. To make this dynamic,
// move ROADMAP_RULES into a `roadmap_templates` table keyed by interest.
const ROADMAP_RULES = {
  "Software / SDE": ["Learn a core programming language deeply", "Practice DSA 1 hour daily on a tracker", "Build one project that solves a real problem", "Contribute to a beginner-friendly open-source repo", "Do 2 mock interviews with a senior or peer", "Polish your GitHub profile and resume"],
  "Core Engineering": ["Strengthen fundamentals from this semester's core subjects", "Get hands-on time in the department lab beyond class hours", "Pursue one relevant certification (CAD/PLC/etc.)", "Take up a mini-project tied to your specialization", "Attend a core-industry workshop or site visit", "Build a resume around lab and project work"],
  "Higher Studies": ["Shortlist target exams (GATE/GRE/GMAT) early", "Build a strong semester GPA — it matters for shortlists", "Start one research-oriented mini-project", "Reach out to a professor for a recommendation letter", "Prepare a statement of purpose draft", "Research 5–8 target universities or institutes"],
  "Government / PSU": ["Begin GATE syllabus mapping against your semester", "Solve previous years' papers topic-wise", "Join a peer study group for accountability", "Track PSU recruitment notifications for your branch", "Revise core subjects in parallel with electives", "Take periodic mock tests to gauge readiness"],
  "Entrepreneurship": ["Talk to 10 potential users about a problem you've noticed", "Build a rough MVP or prototype, however small", "Join or start a college entrepreneurship cell activity", "Learn basic finance and pitching fundamentals", "Apply to a campus incubation or ideation program", "Find one mentor — senior, faculty, or alum"],
};

router.post("/roadmap", requireAuth, (req, res) => {
  const { interest } = req.body || {};
  const items = ROADMAP_RULES[interest];
  if (!items) return res.status(400).json({ error: `interest must be one of ${Object.keys(ROADMAP_RULES).join(", ")}` });
  res.json({ items });
});

module.exports = router;
