const cron = require('node-cron');
const db = require('./db');
const { sendWeeklyUpdate } = require('./mailer');

// Every Friday at 3:30 PM
const SCHEDULE = process.env.EMAIL_SCHEDULE || '30 15 * * 5';

async function runWeeklyEmails() {
  console.log('[mailer] Starting weekly email run...');
  const projects = await db.getProjectsForWeeklyEmail();

  if (!projects.length) {
    console.log('[mailer] No active projects with client emails. Skipping.');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const project of projects) {
    try {
      const allCOs = await db.getCOs(project.id);
      const pendingCOs = allCOs.filter(co => co.status === 'pending');
      await sendWeeklyUpdate(project, pendingCOs);
      console.log(`[mailer] ✓ Sent to ${project.client_email} (${project.name})`);
      sent++;
    } catch (err) {
      console.error(`[mailer] ✗ Failed for project ${project.id} (${project.name}):`, err.message);
      failed++;
    }
  }

  console.log(`[mailer] Weekly run complete. Sent: ${sent}, Failed: ${failed}`);
}

function start() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY not set — weekly emails disabled.');
    return;
  }

  cron.schedule(SCHEDULE, () => {
    runWeeklyEmails().catch(err => console.error('[mailer] Uncaught error in weekly run:', err));
  });

  console.log(`[mailer] Weekly emails scheduled (${SCHEDULE})`);
}

module.exports = { start, runWeeklyEmails };
