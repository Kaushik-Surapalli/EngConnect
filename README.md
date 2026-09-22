# EngConnect — Engineering Student Support Platform

This package has everything to run the full project: a live database-backed
web app, plus a no-backend standalone demo.

```
EngConnect/
├── frontend/
│   ├── index.html              ← the LIVE app (talks to your backend + database)
│   └── demo-standalone.html    ← the original click-around DEMO (mock data, no server needed)
└── backend/
    ├── src/                    ← Express API source
    ├── schema.sql               ← Postgres schema + seed data
    ├── package.json
    ├── .env.example
    └── README.md                ← full setup + deployment instructions
```

## Fastest way to see it running locally (5–10 minutes)

**1. Database + API**
```bash
cd backend
npm install
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET inside it
npm run migrate               # creates tables + seeds demo opportunities/experiences
npm start                     # → API running at http://localhost:4000
```
(No Postgres installed? The quickest option is a free instance on
[neon.tech](https://neon.tech) or [railway.app](https://railway.app) — just
paste their connection string into `DATABASE_URL`.)

**2. Frontend**
- Open `frontend/index.html` in a text editor, find the line near the top of
  the `<script>` block that says:
  ```js
  const API_BASE = "/api";
  ```
  change it to:
  ```js
  const API_BASE = "http://localhost:4000/api";
  ```
- Open `frontend/index.html` directly in your browser (double-click it, or
  serve it with `npx serve frontend`). Register an account and try it.

That's it — you now have a real signup, a real database, and answers/questions
that persist and are shared across anyone who uses the app.

## Going live on the internet

Full step-by-step deployment instructions (Render/Railway for the API,
Netlify/Vercel for the frontend, custom domains, CORS, senior verification,
security hardening checklist) are in **`backend/README.md`**.

Quick summary:
1. Deploy Postgres (Render/Railway/Neon) → get a `DATABASE_URL`.
2. Deploy `backend/` as a Node web service (Render/Railway) with that
   `DATABASE_URL` and a `JWT_SECRET` set as environment variables.
3. Point `frontend/index.html`'s `API_BASE` at your deployed API's URL.
4. Deploy `frontend/index.html` as a static site (Netlify/Vercel/GitHub
   Pages/your own hosting) — rename it to `index.html` if your host requires
   that.
5. Set `CORS_ORIGIN` on the backend to your deployed frontend's exact URL.

## Two files, two purposes

| File | Needs a backend? | Use it for |
|---|---|---|
| `frontend/demo-standalone.html` | No | Quick demos, presentations, sharing a link, testing UI/UX ideas |
| `frontend/index.html` | Yes | The real product — real accounts, real shared data, real anonymity enforced server-side |

## What "anonymous" means in the real version

Identity is never sent to the browser on either side. The backend's
`public_questions` / `public_answers` database views physically don't
contain the asker's or answerer's user ID — only year, branch, category,
and (for answers) a free-text experience tag. See `backend/README.md` →
"How anonymity is enforced here" for the full design.
