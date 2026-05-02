const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.FROM_EMAIL || 'noreply@southernbayconstruction.com';
const ADMIN_CC = process.env.ADMIN_CC_EMAIL || '';
const BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function formatMoney(n) {
  if (!n && n !== 0) return '';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function buildEmailHtml({ project, tasksDone, tasksTotal, pendingCOs, portalUrl }) {
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const pmFirst = (project.pm || 'Your Project Manager').split(/[\s\/]/)[0];
  const clientFirst = (project.client_name || 'there').split(/[\s&,]/)[0].trim() || 'there';
  const typeLabel = project.project_type === 'remodel' ? 'remodel' : 'project';

  const coSection = pendingCOs.length > 0 ? `
    <tr><td style="padding:20px 0 4px">
      <p style="margin:0 0 10px;font-weight:600;color:#c0392b">
        ${pendingCOs.length} pending change order${pendingCOs.length > 1 ? 's' : ''} require${pendingCOs.length === 1 ? 's' : ''} your approval:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${pendingCOs.map(co => `
        <tr>
          <td style="padding:8px 12px;background:#fff8f6;border-left:3px solid #e67e22;margin-bottom:6px;display:block">
            <strong>${co.title}</strong>${co.amount ? ` &mdash; ${formatMoney(co.amount)}` : ''}
            ${co.description ? `<br><span style="color:#666;font-size:13px">${co.description}</span>` : ''}
          </td>
        </tr>`).join('')}
      </table>
      ${portalUrl ? `<p style="margin:12px 0 0"><a href="${portalUrl}" style="background:#e67e22;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:600;font-size:14px">Review &amp; Sign Change Orders &rarr;</a></p>` : ''}
    </td></tr>` : '';

  const portalSection = !pendingCOs.length && portalUrl ? `
    <tr><td style="padding:12px 0 0">
      <a href="${portalUrl}" style="color:#2c7be5;font-size:14px">View your project portal &rarr;</a>
    </td></tr>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">

      <tr><td style="background:#1a2433;padding:24px 32px">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold">Southern Bay Construction</p>
        <p style="margin:4px 0 0;color:#8da0b8;font-size:13px">Weekly Project Update &mdash; ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </td></tr>

      <tr><td style="padding:32px 32px 0">
        <p style="margin:0 0 16px;font-size:16px;color:#222">Hi ${clientFirst},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6">
          I wanted to send you a quick end-of-week update on your ${typeLabel}.
          Here&rsquo;s where things stand heading into the weekend.
        </p>
      </td></tr>

      <tr><td style="padding:16px 32px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:6px;padding:20px">
          <tr>
            <td><p style="margin:0;font-size:18px;font-weight:bold;color:#1a2433">${project.name}</p>
            ${project.address ? `<p style="margin:4px 0 0;color:#666;font-size:13px">${project.address}</p>` : ''}
            </td>
          </tr>
          <tr><td style="padding-top:16px">
            <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Task Progress</p>
            <p style="margin:0;font-size:24px;font-weight:bold;color:#1a2433">${pct}% <span style="font-size:15px;font-weight:normal;color:#666">complete</span></p>
            <p style="margin:4px 0 0;font-size:13px;color:#888">${tasksDone} of ${tasksTotal} tasks</p>
            <div style="margin-top:10px;background:#e0e0e0;border-radius:4px;height:8px;width:100%">
              <div style="background:#2c7be5;border-radius:4px;height:8px;width:${pct}%"></div>
            </div>
          </td></tr>
        </table>
      </td></tr>

      ${coSection}
      ${portalSection}

      <tr><td style="padding:24px 32px 32px">
        <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6">
          Have a great weekend &mdash; I&rsquo;ll be in touch if anything comes up. Feel free to reach out
          with any questions.
        </p>
        <p style="margin:0;font-size:15px;color:#222">
          ${project.pm || 'Your Project Manager'}<br>
          <span style="color:#888;font-size:13px">Project Manager, Southern Bay Construction</span>
        </p>
      </td></tr>

      <tr><td style="background:#f4f4f4;padding:16px 32px;border-top:1px solid #e8e8e8">
        <p style="margin:0;font-size:12px;color:#999;line-height:1.5">
          This is an automated weekly update from Southern Bay Construction.<br>
          ${portalUrl ? `<a href="${portalUrl}" style="color:#2c7be5">View your project portal</a> &middot; ` : ''}
          Questions? Reply to this email or contact your PM directly.
        </p>
      </td></tr>

    </table>
  </td></tr></table>
</body>
</html>`;
}

function buildEmailText({ project, tasksDone, tasksTotal, pendingCOs, portalUrl }) {
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const clientFirst = (project.client_name || 'there').split(/[\s&,]/)[0].trim() || 'there';
  const typeLabel = project.project_type === 'remodel' ? 'remodel' : 'project';

  let text = `Hi ${clientFirst},\n\nI wanted to send you a quick end-of-week update on your ${typeLabel}.\n\n`;
  text += `${project.name}\n`;
  if (project.address) text += `${project.address}\n`;
  text += `\nProgress: ${tasksDone} of ${tasksTotal} tasks complete (${pct}%)\n`;

  if (pendingCOs.length > 0) {
    text += `\n${pendingCOs.length} pending change order${pendingCOs.length > 1 ? 's' : ''} require your approval:\n`;
    pendingCOs.forEach(co => {
      text += `  • ${co.title}${co.amount ? ` — ${formatMoney(co.amount)}` : ''}\n`;
    });
    if (portalUrl) text += `\nReview and sign: ${portalUrl}\n`;
  } else if (portalUrl) {
    text += `\nView your project portal: ${portalUrl}\n`;
  }

  text += `\nHave a great weekend — I'll be in touch if anything comes up.\n\n`;
  text += `${project.pm || 'Your Project Manager'}\nProject Manager, Southern Bay Construction\n`;
  return text;
}

async function sendWeeklyUpdate(project, pendingCOs) {
  const tasksDone = Number(project.tasks_done) || 0;
  const tasksTotal = Number(project.tasks_total) || 0;
  const portalUrl = project.token ? `${BASE_URL}/c/${project.token}` : null;
  const pmFirst = (project.pm || 'Southern Bay Construction').split(/[\s\/]/)[0];

  const payload = { project, tasksDone, tasksTotal, pendingCOs, portalUrl };

  const msg = {
    from: `${pmFirst} at Southern Bay Construction <${FROM}>`,
    to: [project.client_email],
    subject: `${project.name} — Weekly Update`,
    html: buildEmailHtml(payload),
    text: buildEmailText(payload),
  };

  if (ADMIN_CC) msg.cc = [ADMIN_CC];

  const { data, error } = await getResend().emails.send(msg);
  if (error) throw new Error(`Resend error for project ${project.id}: ${error.message}`);
  return data;
}

module.exports = { sendWeeklyUpdate };
