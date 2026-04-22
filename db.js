const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/projects.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function init() {
  await client.executeMultiple(`
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
}

module.exports = {
  init,

  async getAllProjects() {
    const r = await client.execute(`
      SELECT p.*,
        COUNT(CASE WHEN ts.done = 1 THEN 1 END) AS tasks_done,
        COUNT(ts.id) AS tasks_total
      FROM projects p
      LEFT JOIN task_states ts ON ts.project_id = p.id
      WHERE p.status != 'archived'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `);
    return r.rows;
  },

  async getProject(id) {
    const r = await client.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] });
    return r.rows[0] ?? null;
  },

  async createProject({ name, client_name, address, contract_date, est_completion, pm }) {
    const r = await client.execute({
      sql: `INSERT INTO projects (name, client_name, address, contract_date, est_completion, pm)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [name, client_name || '', address || '', contract_date || '', est_completion || '', pm || ''],
    });
    return Number(r.lastInsertRowid);
  },

  async updateProject(id, fields) {
    const allowed = ['name', 'client_name', 'address', 'contract_date', 'est_completion', 'pm', 'status'];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return;
    await client.execute({
      sql: `UPDATE projects SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      args: [...keys.map(k => fields[k]), id],
    });
  },

  async archiveProject(id) {
    await client.execute({
      sql: `UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?`,
      args: [id],
    });
  },

  async getTaskStates(projectId) {
    const r = await client.execute({ sql: 'SELECT task_key, done FROM task_states WHERE project_id = ?', args: [projectId] });
    return Object.fromEntries(r.rows.map(row => [row.task_key, !!row.done]));
  },

  async setTaskState(projectId, taskKey, done) {
    await client.execute({
      sql: `INSERT INTO task_states (project_id, task_key, done) VALUES (?, ?, ?)
            ON CONFLICT(project_id, task_key) DO UPDATE SET done = excluded.done`,
      args: [projectId, taskKey, done ? 1 : 0],
    });
    await client.execute({ sql: `UPDATE projects SET updated_at = datetime('now') WHERE id = ?`, args: [projectId] });
  },

  async getPhaseNotes(projectId) {
    const r = await client.execute({ sql: 'SELECT phase_id, note FROM phase_notes WHERE project_id = ?', args: [projectId] });
    return Object.fromEntries(r.rows.map(row => [row.phase_id, row.note]));
  },

  async setPhaseNote(projectId, phaseId, note) {
    await client.execute({
      sql: `INSERT INTO phase_notes (project_id, phase_id, note) VALUES (?, ?, ?)
            ON CONFLICT(project_id, phase_id) DO UPDATE SET note = excluded.note, updated_at = datetime('now')`,
      args: [projectId, phaseId, note],
    });
  },
};
