# Southern Bay Construction App

Multi-project timeline manager for Southern Bay Construction.

## Tech stack
Node.js + Express + SQLite (libsql/client) + vanilla HTML/CSS/JS frontend

## Key commands
- `npm run dev` — nodemon dev server at http://localhost:3000
- `npm start` — production start

## Key files
- `server.js` — Express app and all REST API routes
- `db.js` — database init and all query functions
- `public/` — static frontend (HTML/CSS/JS)
- `projects.db` — SQLite database file (never commit)

## API routes
- `GET/POST /api/projects` — list / create projects
- `GET/PUT/DELETE /api/projects/:id` — single project
- `GET/POST /api/projects/:id/tasks` — task states per project
- `GET/PUT /api/projects/:id/notes/:phase_id` — phase notes

## Deploy
Vercel (serverless). `module.exports = app` at the bottom of server.js is required.

## Constraints
Never commit `projects.db`, `.env`, or `*.db-shm` / `*.db-wal` files.
