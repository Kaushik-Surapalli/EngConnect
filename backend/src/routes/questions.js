const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const CATEGORIES = ["Academics", "Labs", "Internships", "Placements", "Projects", "Hackathons", "Career", "College Life"];

// Fetches a question's answers from the anonymity-safe view only.
// `viewerId` is used solely to compute whether THIS viewer already marked
// an answer helpful — it is never joined against answered_by.
async function getAnswersFor(questionId, viewerId) {
  const result = await pool.query(
    `SELECT pa.id, pa.senior_year AS "seniorYear", pa.senior_branch AS "seniorBranch",
            pa.experience AS exp, pa.text, pa.helpful_count AS "helpfulCount",
            EXISTS (
              SELECT 1 FROM helpful_marks hm WHERE hm.answer_id = pa.id AND hm.marked_by = $2
            ) AS "helpfulByMe"
     FROM public_answers pa
     WHERE pa.question_id = $1
     ORDER BY pa.created_at ASC`,
    [questionId, viewerId]
  );
  return result.rows;
}

// GET /api/questions/mine — the logged-in student's own posted questions.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const qs = await pool.query(
      `SELECT id, category, text, asked_year AS "askedYear", asked_branch AS "askedBranch", created_at AS "createdAt"
       FROM questions WHERE asked_by = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    const withAnswers = await Promise.all(
      qs.rows.map(async (q) => ({ ...q, mine: true, answers: await getAnswersFor(q.id, req.user.id) }))
    );
    res.json({ questions: withAnswers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load your questions." });
  }
});

// POST /api/questions — post a new question anonymously.
// asked_year/asked_branch come from the logged-in user's OWN profile,
// never from client input, so a junior can't spoof a different year/branch.
router.post("/", requireAuth, async (req, res) => {
  const { text, category } = req.body || {};
  if (!text || text.trim().length < 8) return res.status(400).json({ error: "Question text is too short." });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
  try {
    const result = await pool.query(
      `INSERT INTO questions (asked_by, asked_year, asked_branch, category, text)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, category, text, asked_year AS "askedYear", asked_branch AS "askedBranch", created_at AS "createdAt"`,
      [req.user.id, req.user.year, req.user.branch, category, text.trim()]
    );
    res.status(201).json({ question: { ...result.rows[0], mine: true, answers: [] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not post your question." });
  }
});

// GET /api/questions/:id — full detail + answers. Readable by any logged-in
// user (a senior needs to read it before answering); only the columns from
// public_questions ever leave the server, so the asker's identity is never
// included even here.
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT id, category, text, asked_year AS "askedYear", asked_branch AS "askedBranch", created_at AS "createdAt"
       FROM public_questions WHERE id = $1`,
      [req.params.id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "Question not found." });
    const owner = await pool.query("SELECT asked_by FROM questions WHERE id = $1", [req.params.id]);
    const mine = owner.rows[0] && owner.rows[0].asked_by === req.user.id;
    const answers = await getAnswersFor(req.params.id, req.user.id);
    res.json({ question: { ...q.rows[0], mine, answers } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load question." });
  }
});

// GET /api/questions/queue/unanswered — for verified seniors: every
// question this specific senior has not yet answered. Only asked_year /
// asked_branch / category / text are ever returned — never asked_by.
router.get("/queue/unanswered", requireAuth, async (req, res) => {
  if (req.user.role !== "senior") {
    return res.status(403).json({ error: "Only seniors can view the answer queue." });
  }
  const verifiedCheck = await pool.query("SELECT is_verified FROM users WHERE id = $1", [req.user.id]);
  if (!verifiedCheck.rows[0] || !verifiedCheck.rows[0].is_verified) {
    return res.status(403).json({ error: "Your senior account isn't verified yet." });
  }
  try {
    const result = await pool.query(
      `SELECT pq.id, pq.category, pq.text, pq.asked_year AS "askedYear", pq.asked_branch AS "askedBranch",
              pq.created_at AS "createdAt",
              (SELECT count(*) FROM answers a WHERE a.question_id = pq.id)::int AS "answerCount"
       FROM public_questions pq
       WHERE NOT EXISTS (
         SELECT 1 FROM answers a WHERE a.question_id = pq.id AND a.answered_by = $1
       )
       ORDER BY pq.created_at DESC`,
      [req.user.id]
    );
    res.json({ questions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the answer queue." });
  }
});

module.exports = router;
