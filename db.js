const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new DatabaseSync(path.join(dataDir, 'projects.db'));

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    client_name     TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    contract_date   TEXT DEFAULT '',
    est_completion  TEXT DEFAULT '',
    pm              TEXT DEFAULT '',
    status          TEXT DEFAULT 'active',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_states (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL,
    task_key    TEXT NOT NULL,
    done        INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, task_key)
  );

  CREATE TABLE IF NOT EXISTS phase_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL,
    phase_id    INTEGER NOT NULL,
    note        TEXT DEFAULT '',
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, phase_id)
  );
`);

module.exports = {
  getAllProjects() {
    return db.prepare(`
      SELECT p.*,
        COUNT(CASE WHEN ts.done = 1 THEN 1 END) AS tasks_done,
        COUNT(ts.id) AS tasks_total
      FROM projects p
      LEFT JOIN task_states ts ON ts.project_id = p.id
      WHERE p.status != 'archived'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `).all();
  },

  getProject(id) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  },

  createProject({ name, client_name, address, contract_date, est_completion, pm }) {
    const r = db.prepare(`
      INSERT INTO projects (name, client_name, address, contract_date, est_completion, pm)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, client_name || '', address || '', contract_date || '', est_completion || '', pm || '');
    return r.lastInsertRowid;
  },

  updateProject(id, fields) {
    const allowed = ['name', 'client_name', 'address', 'contract_date', 'est_completion', 'pm', 'status'];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return;
    const sql = `UPDATE projects SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`;
    db.prepare(sql).run(...keys.map(k => fields[k]), id);
  },

  archiveProject(id) {
    db.prepare(`UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).run(id);
  },

  getTaskStates(projectId) {
    const rows = db.prepare('SELECT task_key, done FROM task_states WHERE project_id = ?').all(projectId);
    return Object.fromEntries(rows.map(r => [r.task_key, !!r.done]));
  },

  setTaskState(projectId, taskKey, done) {
    db.prepare(`
      INSERT INTO task_states (project_id, task_key, done) VALUES (?, ?, ?)
      ON CONFLICT(project_id, task_key) DO UPDATE SET done = excluded.done
    `).run(projectId, taskKey, done ? 1 : 0);
    db.prepare(`UPDATE projects SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
  },

  getPhaseNotes(projectId) {
    const rows = db.prepare('SELECT phase_id, note FROM phase_notes WHERE project_id = ?').all(projectId);
    return Object.fromEntries(rows.map(r => [r.phase_id, r.note]));
  },

  setPhaseNote(projectId, phaseId, note) {
    db.prepare(`
      INSERT INTO phase_notes (project_id, phase_id, note) VALUES (?, ?, ?)
      ON CONFLICT(project_id, phase_id) DO UPDATE SET note = excluded.note, updated_at = datetime('now')
    `).run(projectId, phaseId, note);
  },
};
