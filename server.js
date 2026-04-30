const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CUSTOMER PORTAL (must come before catch-all) ──────────────────
app.get('/c/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// ── PROJECTS ─────────────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  res.json(await db.getAllProjects());
});

app.post('/api/projects', async (req, res) => {
  try {
    const { budget_items, ...projectData } = req.body;
    const id = await db.createProject(projectData);
    if (budget_items && budget_items.length) {
      await db.seedBudgetItems(id, budget_items);
    }
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const project = await db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.put('/api/projects/:id', async (req, res) => {
  await db.updateProject(req.params.id, req.body);
  res.json({ ok: true });
});

app.delete('/api/projects/:id', async (req, res) => {
  await db.archiveProject(req.params.id);
  res.json({ ok: true });
});

// ── TASKS ─────────────────────────────────────────────────────────

app.get('/api/projects/:id/tasks', async (req, res) => {
  res.json(await db.getTaskStates(req.params.id));
});

app.post('/api/projects/:id/tasks', async (req, res) => {
  const { task_key, done } = req.body;
  if (!task_key) return res.status(400).json({ error: 'task_key required' });
  await db.setTaskState(req.params.id, task_key, done);
  res.json({ ok: true });
});

// ── NOTES ─────────────────────────────────────────────────────────

app.get('/api/projects/:id/notes', async (req, res) => {
  res.json(await db.getPhaseNotes(req.params.id));
});

app.put('/api/projects/:id/notes/:phase_id', async (req, res) => {
  await db.setPhaseNote(req.params.id, req.params.phase_id, req.body.note || '');
  res.json({ ok: true });
});

// ── BUDGET ────────────────────────────────────────────────────────

app.get('/api/projects/:id/budget', async (req, res) => {
  res.json(await db.getBudgetItems(req.params.id));
});

app.put('/api/projects/:id/budget/:item_id', async (req, res) => {
  try {
    await db.updateBudgetItem(req.params.item_id, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── CHANGE ORDERS ─────────────────────────────────────────────────

app.get('/api/projects/:id/cos', async (req, res) => {
  res.json(await db.getCOs(req.params.id));
});

app.post('/api/projects/:id/cos', async (req, res) => {
  try {
    const { phase_id, title, description, amount } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const id = await db.addCO(req.params.id, { phase_id, title, description, amount });
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/projects/:id/cos/:co_id/sign', async (req, res) => {
  const { signed_by } = req.body;
  if (!signed_by) return res.status(400).json({ error: 'signed_by required' });
  await db.signCO(req.params.co_id, signed_by);
  res.json({ ok: true });
});

app.post('/api/projects/:id/cos/:co_id/reject', async (req, res) => {
  await db.rejectCO(req.params.co_id, req.body.reason || '');
  res.json({ ok: true });
});

// ── DECISIONS ─────────────────────────────────────────────────────

app.get('/api/projects/:id/decisions', async (req, res) => {
  res.json(await db.getDecisions(req.params.id));
});

app.post('/api/projects/:id/decisions', async (req, res) => {
  const { phase_id, dec_index, confirmed } = req.body;
  await db.setDecision(req.params.id, phase_id, dec_index, confirmed);
  res.json({ ok: true });
});

// ── CUSTOMER TOKEN ─────────────────────────────────────────────────

app.post('/api/projects/:id/customer-link', async (req, res) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const token = await db.createCustomerToken(req.params.id);
    res.json({ token, url: `/c/${token}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CUSTOMER API ───────────────────────────────────────────────────

app.get('/api/customer/:token', async (req, res) => {
  const project = await db.getProjectByToken(req.params.token);
  if (!project) return res.status(404).json({ error: 'Invalid or expired link' });
  const [cos, decisions] = await Promise.all([
    db.getCOsByToken(req.params.token),
    db.getDecisionsByToken(req.params.token),
  ]);
  res.json({ project, cos, decisions });
});

app.post('/api/customer/:token/cos/:co_id/sign', async (req, res) => {
  const project = await db.getProjectByToken(req.params.token);
  if (!project) return res.status(404).json({ error: 'Invalid link' });
  const cos = await db.getCOs(project.id);
  if (!cos.find(c => c.id === req.params.co_id)) return res.status(404).json({ error: 'Change order not found' });
  const { signed_by } = req.body;
  if (!signed_by) return res.status(400).json({ error: 'signed_by required' });
  await db.signCO(req.params.co_id, signed_by);
  res.json({ ok: true });
});

app.post('/api/customer/:token/cos/:co_id/reject', async (req, res) => {
  const project = await db.getProjectByToken(req.params.token);
  if (!project) return res.status(404).json({ error: 'Invalid link' });
  const cos = await db.getCOs(project.id);
  if (!cos.find(c => c.id === req.params.co_id)) return res.status(404).json({ error: 'Change order not found' });
  await db.rejectCO(req.params.co_id, req.body.reason || '');
  res.json({ ok: true });
});

app.post('/api/customer/:token/decisions', async (req, res) => {
  try {
    const { phase_id, dec_index, confirmed } = req.body;
    await db.setDecisionByToken(req.params.token, phase_id, dec_index, confirmed);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── CATCH-ALL ─────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Southern Bay Construction`);
    console.log(`  Running at http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});
