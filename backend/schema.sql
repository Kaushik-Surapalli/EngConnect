-- =========================================================================
-- EngConnect schema
-- Run once against a fresh Postgres database (see README "Database setup").
--
-- ANONYMITY DESIGN
-- -----------------
-- Identity (asked_by / answered_by) is stored so the app can do things like
-- "don't let a senior answer the same question twice" or "only the asker can
-- mark an answer helpful" — but no API route ever returns those columns to a
-- client. As a second layer of protection (defense in depth, in case a route
-- is written carelessly later), two VIEWS below expose only the safe columns.
-- Read-heavy routes should select from the views, not the base tables.
-- =========================================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  year          INT NOT NULL CHECK (year BETWEEN 1 AND 4),
  branch        TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','senior','admin')),
  -- Seniors self-select their role at signup but stay unverified until an
  -- admin approves them (see README "Senior verification"). Only verified
  -- seniors can answer questions.
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Question IDs look like Q1042, continuing the numbering used in the demo.
CREATE SEQUENCE IF NOT EXISTS question_id_seq START WITH 1042;
CREATE OR REPLACE FUNCTION next_question_id() RETURNS text AS $$
  SELECT 'Q' || nextval('question_id_seq')::text;
$$ LANGUAGE sql;

CREATE TABLE IF NOT EXISTS questions (
  id           TEXT PRIMARY KEY DEFAULT next_question_id(),
  asked_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asked_year   INT NOT NULL,
  asked_branch TEXT NOT NULL,
  category     TEXT NOT NULL,
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answers (
  id           SERIAL PRIMARY KEY,
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answered_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  senior_year  INT NOT NULL,
  senior_branch TEXT NOT NULL,
  experience   TEXT NOT NULL DEFAULT '',
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, answered_by) -- one answer per senior per question
);

CREATE TABLE IF NOT EXISTS helpful_marks (
  answer_id  INTEGER NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  marked_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (answer_id, marked_by)
);

CREATE TABLE IF NOT EXISTS opportunities (
  id       TEXT PRIMARY KEY,
  type     TEXT NOT NULL,
  title    TEXT NOT NULL,
  org      TEXT NOT NULL,
  branch   TEXT[] NOT NULL,
  year     INT[] NOT NULL,
  skills   TEXT[] NOT NULL DEFAULT '{}',
  deadline TEXT,
  mode     TEXT
);

CREATE TABLE IF NOT EXISTS experiences (
  id       SERIAL PRIMARY KEY,
  branch   TEXT NOT NULL,
  year     INT NOT NULL,
  topic    TEXT NOT NULL,
  category TEXT NOT NULL
);

-- ---- anonymity-safe read views -------------------------------------------
CREATE OR REPLACE VIEW public_questions AS
  SELECT id, asked_year, asked_branch, category, text, created_at
  FROM questions;

CREATE OR REPLACE VIEW public_answers AS
  SELECT
    a.id, a.question_id, a.senior_year, a.senior_branch, a.experience, a.text, a.created_at,
    (SELECT count(*) FROM helpful_marks hm WHERE hm.answer_id = a.id)::int AS helpful_count
  FROM answers a;

CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_asked_by ON questions(asked_by);

-- ---- seed / demo data (safe to delete once you have real content) -------
INSERT INTO opportunities (id, type, title, org, branch, year, skills, deadline, mode) VALUES
  ('OP1','Internship','Summer SDE Internship','Devstack Labs', ARRAY['CSE','IT'], ARRAY[2,3], ARRAY['DSA','Web Dev'], '5 Oct 2026','Remote'),
  ('OP2','Hackathon','CodeSprint 48hr Hackathon','TechFest National', ARRAY['CSE','IT','ECE','EEE'], ARRAY[1,2,3,4], ARRAY['Teamwork','Problem Solving'], '12 Oct 2026','Hybrid'),
  ('OP3','Job','Graduate Engineer Trainee','Meridian Power Corp', ARRAY['EEE','MECH','CIVIL'], ARRAY[4], ARRAY['Core Engineering'], '20 Oct 2026','On-site'),
  ('OP4','Workshop','Intro to Embedded Systems','IEEE Student Chapter', ARRAY['ECE','EEE'], ARRAY[2,3], ARRAY['Embedded C','IoT'], '1 Oct 2026','On-campus'),
  ('OP5','Training','Full-Stack Bootcamp (6 wks)','CodeCraft Academy', ARRAY['CSE','IT'], ARRAY[2,3,4], ARRAY['React','Node.js'], 'Rolling','Remote'),
  ('OP6','Coding Contest','Monthly Algorithmic Challenge','CodeArena', ARRAY['CSE','IT','ECE','EEE','MECH','CIVIL'], ARRAY[1,2,3,4], ARRAY['DSA','Competitive Coding'], '30 Sep 2026','Online'),
  ('OP7','Scholarship','Merit-cum-Means Scholarship','State Education Board', ARRAY['CSE','IT','ECE','EEE','MECH','CIVIL'], ARRAY[1,2,3,4], ARRAY[]::text[], '15 Nov 2026','Application'),
  ('OP8','Internship','Data Analyst Intern','InsightWorks', ARRAY['CSE','IT','EEE'], ARRAY[3,4], ARRAY['SQL','Python'], '8 Oct 2026','Remote'),
  ('OP9','Job','Site Engineer — Fresher','Buildright Infra', ARRAY['CIVIL'], ARRAY[4], ARRAY['AutoCAD','Site Management'], '25 Oct 2026','On-site'),
  ('OP10','Workshop','Resume & Interview Clinic','Career Cell', ARRAY['CSE','IT','ECE','EEE','MECH','CIVIL'], ARRAY[3,4], ARRAY['Communication'], '3 Oct 2026','On-campus')
ON CONFLICT (id) DO NOTHING;

INSERT INTO experiences (branch, year, topic, category) VALUES
  ('CSE',3,'Internship experience','Internships'),
  ('CSE',4,'Placement preparation','Internships'),
  ('IT',4,'Project experience','Internships'),
  ('ECE',3,'Switched branch into software','Internships'),
  ('CSE',4,'On-campus placement, 3 offers','Placements'),
  ('MECH',4,'Off-campus software placement','Placements'),
  ('IT',3,'Resume shortlisted at 6 companies','Placements'),
  ('CSE',3,'DBMS + OS lab viva prep','Labs'),
  ('EEE',2,'Circuits lab troubleshooting','Labs'),
  ('CSE',4,'Won inter-college hackathon','Hackathons'),
  ('IT',3,'First hackathon as a beginner','Hackathons'),
  ('CSE',4,'Published 2 open-source projects','Projects'),
  ('CIVIL',4,'Capstone project, industry mentor','Projects'),
  ('CSE',3,'Elective selection for AI/ML','Academics'),
  ('ECE',4,'GATE prep alongside placements','Career'),
  ('MECH',4,'Chose core engineering job offer','Career'),
  ('CSE',2,'Balancing clubs and coursework','College Life'),
  ('IT',3,'Managing hostel life + internships','College Life')
ON CONFLICT DO NOTHING;
