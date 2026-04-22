const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── PROJECTS ─────────────────────────────────────────────────────

app.get('/api/projects', (req, res) => {
  res.json(db.getAllProjects());
});

app.post('/api/projects', (req, res) => {
  try {
    const id = db.createProject(req.body);
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.put('/api/projects/:id', (req, res) => {
  db.updateProject(req.params.id, req.body);
  res.json({ ok: true });
});

app.delete('/api/projects/:id', (req, res) => {
  db.archiveProject(req.params.id);
  res.json({ ok: true });
});

// ── TASKS ─────────────────────────────────────────────────────────

app.get('/api/projects/:id/tasks', (req, res) => {
  res.json(db.getTaskStates(req.params.id));
});

app.post('/api/projects/:id/tasks', (req, res) => {
  const { task_key, done } = req.body;
  if (!task_key) return res.status(400).json({ error: 'task_key required' });
  db.setTaskState(req.params.id, task_key, done);
  res.json({ ok: true });
});

// ── NOTES ─────────────────────────────────────────────────────────

app.get('/api/projects/:id/notes', (req, res) => {
  res.json(db.getPhaseNotes(req.params.id));
});

app.put('/api/projects/:id/notes/:phase_id', (req, res) => {
  db.setPhaseNote(req.params.id, req.params.phase_id, req.body.note || '');
  res.json({ ok: true });
});

// ── CATCH-ALL ─────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Southern Bay Construction`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
