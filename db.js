const { createClient } = require('@libsql/client');
const crypto = require('crypto');

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
    CREATE TABLE IF NOT EXISTS budget_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      phase_id    INTEGER NOT NULL,
      item        TEXT NOT NULL,
      amt         REAL,
      note        TEXT DEFAULT '',
      sort_order  INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS change_orders (
      id               TEXT PRIMARY KEY,
      project_id       INTEGER NOT NULL,
      phase_id         INTEGER NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT DEFAULT '',
      amount           REAL DEFAULT 0,
      status           TEXT DEFAULT 'pending',
      requested_at     TEXT DEFAULT (datetime('now')),
      signed_at        TEXT,
      signed_by        TEXT DEFAULT '',
      rejected_at      TEXT,
      rejection_reason TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS customer_tokens (
      token      TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      phase_id    INTEGER NOT NULL,
      dec_index   INTEGER NOT NULL,
      confirmed   INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, phase_id, dec_index)
    );
  `);
}

module.exports = {
  init,

  // ── PROJECTS ─────────────────────────────────────────────────
  async getAllProjects() {
    const r = await client.execute(`
      SELECT p.*,
        COUNT(CASE WHEN ts.done = 1 THEN 1 END) AS tasks_done,
        COUNT(ts.id) AS tasks_total,
        SUM(CASE WHEN co.status = 'pending' THEN 1 ELSE 0 END) AS cos_pending,
        SUM(CASE WHEN co.status = 'signed'  THEN 1 ELSE 0 END) AS cos_signed
      FROM projects p
      LEFT JOIN task_states  ts ON ts.project_id = p.id
      LEFT JOIN change_orders co ON co.project_id = p.id
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

  // ── TASKS ─────────────────────────────────────────────────────
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

  // ── NOTES ─────────────────────────────────────────────────────
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

  // ── BUDGET ────────────────────────────────────────────────────
  async seedBudgetItems(projectId, items) {
    for (const [i, it] of items.entries()) {
      await client.execute({
        sql: `INSERT INTO budget_items (project_id, phase_id, item, amt, note, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [projectId, it.phase_id, it.item, it.amt ?? null, it.note || '', i],
      });
    }
  },

  async getBudgetItems(projectId) {
    const r = await client.execute({
      sql: 'SELECT * FROM budget_items WHERE project_id = ? ORDER BY phase_id, sort_order',
      args: [projectId],
    });
    return r.rows;
  },

  async updateBudgetItem(itemId, { amt, note }) {
    await client.execute({
      sql: 'UPDATE budget_items SET amt = ?, note = ? WHERE id = ?',
      args: [amt !== undefined ? (amt === '' || amt === null ? null : parseFloat(amt)) : null, note ?? '', itemId],
    });
  },

  // ── CHANGE ORDERS ─────────────────────────────────────────────
  async getCOs(projectId) {
    const r = await client.execute({
      sql: 'SELECT * FROM change_orders WHERE project_id = ? ORDER BY requested_at ASC',
      args: [projectId],
    });
    return r.rows;
  },

  async addCO(projectId, { phase_id, title, description, amount }) {
    const id = 'co_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await client.execute({
      sql: `INSERT INTO change_orders (id, project_id, phase_id, title, description, amount) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, projectId, phase_id, title, description || '', parseFloat(amount) || 0],
    });
    return id;
  },

  async signCO(coId, signedBy) {
    await client.execute({
      sql: `UPDATE change_orders SET status = 'signed', signed_at = datetime('now'), signed_by = ? WHERE id = ?`,
      args: [signedBy, coId],
    });
  },

  async rejectCO(coId, reason) {
    await client.execute({
      sql: `UPDATE change_orders SET status = 'rejected', rejected_at = datetime('now'), rejection_reason = ? WHERE id = ?`,
      args: [reason || '', coId],
    });
  },

  // ── DECISIONS ─────────────────────────────────────────────────
  async getDecisions(projectId) {
    const r = await client.execute({
      sql: 'SELECT phase_id, dec_index, confirmed FROM decisions WHERE project_id = ?',
      args: [projectId],
    });
    const result = {};
    for (const row of r.rows) {
      result[`${row.phase_id}_${row.dec_index}`] = !!row.confirmed;
    }
    return result;
  },

  async setDecision(projectId, phaseId, decIndex, confirmed) {
    await client.execute({
      sql: `INSERT INTO decisions (project_id, phase_id, dec_index, confirmed) VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id, phase_id, dec_index) DO UPDATE SET confirmed = excluded.confirmed`,
      args: [projectId, phaseId, decIndex, confirmed ? 1 : 0],
    });
  },

  // ── CUSTOMER TOKENS ───────────────────────────────────────────
  async createCustomerToken(projectId) {
    await client.execute({ sql: 'DELETE FROM customer_tokens WHERE project_id = ?', args: [projectId] });
    const token = crypto.randomBytes(24).toString('hex');
    await client.execute({
      sql: 'INSERT INTO customer_tokens (token, project_id) VALUES (?, ?)',
      args: [token, projectId],
    });
    return token;
  },

  async getProjectByToken(token) {
    const r = await client.execute({
      sql: `SELECT p.* FROM projects p
            JOIN customer_tokens ct ON ct.project_id = p.id
            WHERE ct.token = ? AND p.status != 'archived'`,
      args: [token],
    });
    return r.rows[0] ?? null;
  },

  async getCOsByToken(token) {
    const r = await client.execute({
      sql: `SELECT co.* FROM change_orders co
            JOIN customer_tokens ct ON ct.project_id = co.project_id
            WHERE ct.token = ?
            ORDER BY co.requested_at ASC`,
      args: [token],
    });
    return r.rows;
  },

  async getDecisionsByToken(token) {
    const r = await client.execute({
      sql: `SELECT d.phase_id, d.dec_index, d.confirmed FROM decisions d
            JOIN customer_tokens ct ON ct.project_id = d.project_id
            WHERE ct.token = ?`,
      args: [token],
    });
    const result = {};
    for (const row of r.rows) {
      result[`${row.phase_id}_${row.dec_index}`] = !!row.confirmed;
    }
    return result;
  },

  async setDecisionByToken(token, phaseId, decIndex, confirmed) {
    const r = await client.execute({
      sql: 'SELECT project_id FROM customer_tokens WHERE token = ?',
      args: [token],
    });
    const row = r.rows[0];
    if (!row) throw new Error('Invalid token');
    await this.setDecision(row.project_id, phaseId, decIndex, confirmed);
  },
};
