const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireVerifiedSenior } = require("../middleware/auth");

const router = express.Router();

// POST /api/answers/:questionId — a verified senior answers a question.
// senior_year/senior_branch come from the logged-in user's OWN profile,
// never from client input. The response never includes answered_by.
router.post("/:questionId", requireAuth, requireVerifiedSenior, async (req, res) => {
  const { text, experience } = req.body || {};
  if (!text || text.trim().length < 8) return res.status(400).json({ error: "Answer text is too short." });

  try {
    const qCheck = await pool.query("SELECT id FROM questions WHERE id = $1", [req.params.questionId]);
    if (!qCheck.rows[0]) return res.status(404).json({ error: "Question not found." });

    const insert = await pool.query(
      `INSERT INTO answers (question_id, answered_by, senior_year, senior_branch, experience, text)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (question_id, answered_by) DO NOTHING
       RETURNING id, senior_year AS "seniorYear", senior_branch AS "seniorBranch", experience AS exp, text`,
      [req.params.questionId, req.user.id, req.user.year, req.user.branch, (experience || "Verified senior").trim(), text.trim()]
    );
    if (!insert.rows[0]) return res.status(409).json({ error: "You've already answered this question." });

    const countResult = await pool.query("SELECT count(*)::int AS n FROM answers WHERE question_id = $1", [req.params.questionId]);
    res.status(201).json({
      answer: { ...insert.rows[0], helpfulCount: 0, helpfulByMe: false },
      answerCount: countResult.rows[0].n,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit your answer." });
  }
});

// POST /api/answers/helpful/:answerId — toggle "helpful". Only the student
// who asked the original question is allowed to mark an answer helpful.
router.post("/helpful/:answerId", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT q.asked_by FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = $1`,
      [req.params.answerId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Answer not found." });
    if (check.rows[0].asked_by !== req.user.id) {
      return res.status(403).json({ error: "Only the student who asked can mark answers helpful." });
    }

    const existing = await pool.query(
      "SELECT 1 FROM helpful_marks WHERE answer_id = $1 AND marked_by = $2",
      [req.params.answerId, req.user.id]
    );
    if (existing.rows.length) {
      await pool.query("DELETE FROM helpful_marks WHERE answer_id = $1 AND marked_by = $2", [req.params.answerId, req.user.id]);
    } else {
      await pool.query("INSERT INTO helpful_marks (answer_id, marked_by) VALUES ($1,$2)", [req.params.answerId, req.user.id]);
    }
    const count = await pool.query("SELECT count(*)::int AS n FROM helpful_marks WHERE answer_id = $1", [req.params.answerId]);
    res.json({ helpfulByMe: !existing.rows.length, helpfulCount: count.rows[0].n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update helpful mark." });
  }
});

module.exports = router;
