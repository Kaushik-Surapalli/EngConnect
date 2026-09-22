# EngConnect API

Node/Express + PostgreSQL backend for EngConnect. Handles accounts, anonymous
questions, anonymous answers, the opportunity radar, experiences and the
semester roadmap.

## How anonymity is enforced here

Every question and answer *is* linked to a `user_id` in the database (so the
app can stop a senior answering twice, or check who's allowed to mark an
answer "helpful") — but:

- No API route ever returns `asked_by` or `answered_by`.
- Read routes select from `public_questions` / `public_answers` — two SQL
  **views** that don't even expose those columns, as a second layer of
  protection if a route is ever written carelessly later.
- Login tokens (JWT) only ever contain `{ id, role, year, branch, isVerified }`
  — never email or name.

If you extend this API, keep that boundary: **no route should ever return
one user's identity to another user.**

## 1. Local setup

```bash
# 1. Install Postgres locally (or use Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres)
# 2. Create a database
createdb engconnect

# 3. Install dependencies
cd engconnect-backend
npm install

# 4. Configure environment
cp .env.example .env
# edit .env: set DATABASE_URL to your local Postgres, and generate a JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 5. Create tables + seed demo opportunities/experiences
npm run migrate

# 6. Start the API
npm start
# -> EngConnect API listening on port 4000
```

Test it's alive: `curl http://localhost:4000/api/health` should return `{"ok":true,...}`.

## 2. Deploy the database

Pick any managed Postgres — they all just give you a `DATABASE_URL`:

- **Render** → New → PostgreSQL (free tier available)
- **Railway** → New Project → Database → PostgreSQL
- **Neon** (neon.tech) → New Project (generous free tier, serverless Postgres)
- **Supabase** → New Project (you get a Postgres DB even if you don't use their auth)

Copy the connection string into `DATABASE_URL`, then run `npm run migrate`
once (from your machine, pointed at the remote DB) to create the tables.

## 3. Deploy the API

**Render (recommended, simplest):**
1. Push this `engconnect-backend` folder to a GitHub repo.
2. Render → New → Web Service → connect the repo.
3. Build command: `npm install` · Start command: `npm start`
4. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (set this once you know your frontend's URL — see step 4).
5. Deploy. You'll get a URL like `https://engconnect-api.onrender.com`.

**Railway** works the same way (New Project → Deploy from GitHub repo → add
the same env vars).

## 4. Deploy the frontend

The frontend is the single `engconnect-live.html` file provided alongside
this backend. It is a **static file** — no build step.

1. Open `engconnect-live.html` and set the `API_BASE` constant near the top
   of the `<script>` block to your deployed API URL, e.g.
   `const API_BASE = "https://engconnect-api.onrender.com/api";`
2. Deploy the static file:
   - **Netlify**: drag-and-drop the file onto app.netlify.com/drop
   - **Vercel**: `vercel deploy` in a folder containing the file (rename to `index.html`)
   - **GitHub Pages**: commit it as `index.html` in a repo, enable Pages
   - Or upload it to any static hosting / your own domain's web server
3. Go back to the backend's environment variables and set `CORS_ORIGIN` to
   the **exact** URL your frontend is now live at (e.g.
   `https://engconnect.netlify.app`), then redeploy the backend.

> **Why not just use the claude.ai preview link?** That page runs inside a
> sandbox whose security policy only allows network requests to a short list
> of script CDNs — it cannot call your API at all. Self-hosting the HTML
> file (steps above) removes that restriction completely.

## 5. Senior verification (do this before real launch)

Right now anyone can register as a "senior" if they claim to be 3rd/4th
year — `is_verified` defaults to `false` for them, and `requireVerifiedSenior`
blocks unverified seniors from answering. To actually verify people, add an
admin route (or a manual `UPDATE users SET is_verified = true WHERE email = ...`)
gated behind a real review step — e.g. checking a college ID card or transcript
upload, or requiring a `.edu`/college email domain at signup.

## 6. Production hardening checklist

- [ ] Move the JWT out of `localStorage` into an httpOnly cookie (safer against XSS)
- [ ] Add rate limiting on `/api/auth/*` (e.g. `express-rate-limit`)
- [ ] Restrict registration to your college's email domain
- [ ] Add real senior verification (see above)
- [ ] Add HTTPS (automatic on Render/Railway/Netlify/Vercel)
- [ ] Set up automated Postgres backups (your host usually offers this)
- [ ] Add logging/monitoring (e.g. Sentry) — but never log emails alongside question/answer IDs

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{email,password,year,branch,role}` → `{token,user}` |
| POST | `/api/auth/login` | — | `{email,password}` → `{token,user}` |
| GET | `/api/auth/me` | ✔ | Current user's own profile |
| GET | `/api/questions/mine` | ✔ | Your posted questions + answers |
| POST | `/api/questions` | ✔ | `{text,category}` → new question |
| GET | `/api/questions/:id` | ✔ | One question + its answers |
| GET | `/api/questions/queue/unanswered` | ✔ senior | Questions you haven't answered yet |
| POST | `/api/answers/:questionId` | ✔ verified senior | `{text,experience}` → new answer |
| POST | `/api/answers/helpful/:answerId` | ✔ | Toggle helpful mark (question owner only) |
| GET | `/api/opportunities` | ✔ | `?branch=&year=&skill=&type=` |
| GET | `/api/experiences` | ✔ | `?category=` |
| POST | `/api/roadmap` | ✔ | `{interest}` → suggested activities |
