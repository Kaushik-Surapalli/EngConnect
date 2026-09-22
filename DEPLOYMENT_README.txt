ENGCONNECT - NETLIFY-READY FRONTEND
===================================

The frontend files have been moved to the repository root so Netlify can find
index.html directly.

ROOT:
  index.html
  demo-standalone.html
  netlify.toml
  backend/

NETLIFY:
  Publish directory: .
  Build command: leave empty

IMPORTANT - FULL LOGIN APP:
The live index.html is the database-backed version and needs the Express
backend. At the moment it uses:

  const API_BASE = "/api";

If the backend is hosted separately (Render/Railway/etc.), change that line
to your actual backend URL, for example:

  const API_BASE = "https://YOUR-BACKEND.onrender.com/api";

Then push to GitHub and let Netlify redeploy.

If you only want a no-backend demo, rename demo-standalone.html to index.html
(or deploy the file directly as the site's index).
