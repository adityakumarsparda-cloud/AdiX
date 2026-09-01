// n8n Code node: "Build digest"  (mode: Run Once for All Items)
//
// Collapses every scored job into the single email you actually read.
// Returns no items when nothing scored high enough, which stops the Gmail node
// from sending an empty digest.

const rows = $('Read scores').all().map((i) => i.json);
const jobs = rows.filter((r) => !r.error);
const failures = rows.filter((r) => r.error);

if (!jobs.length && !failures.length) return [];

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const card = (j) => `
  <div style="border:1px solid #d6dbe1;border-radius:6px;padding:14px;margin:0 0 14px">
    <div style="font:600 16px/1.3 system-ui,sans-serif;color:#1f3d5c">
      ${esc(j.Title)} — ${esc(j.Company)}
    </div>
    <div style="font:13px/1.5 system-ui,sans-serif;color:#4a5560;margin:2px 0 10px">
      ${esc(j.Location)} &nbsp;·&nbsp; fit ${esc(j.FitScore)}/10 &nbsp;·&nbsp; ${esc(j.Verdict)}
    </div>
    ${j.Gaps ? `<div style="font:13px/1.5 system-ui,sans-serif;color:#8a4b2a;margin:0 0 10px">
      Gaps: ${esc(j.Gaps)}</div>` : ''}
    <div style="font:14px/1.6 system-ui,sans-serif;color:#1a1a1a;background:#f6f8fa;
                border-radius:4px;padding:10px;white-space:pre-wrap">${esc(j.Opening)}</div>
    <div style="margin-top:12px">
      <a href="${esc(j.URL)}" style="font:600 14px system-ui,sans-serif;color:#1f3d5c">
        Open and apply &rarr;</a>
    </div>
  </div>`;

const problems = failures.length ? `
  <p style="font:13px/1.5 system-ui,sans-serif;color:#8a4b2a">
    ${failures.length} posting(s) could not be scored:
    ${esc(failures.map((f) => `${f.Title || f.JobId}: ${f.error}`).join(' | '))}
  </p>` : '';

const html = `
  <div style="max-width:640px;margin:0 auto">
    <p style="font:14px/1.5 system-ui,sans-serif;color:#4a5560">
      ${jobs.length} matching role${jobs.length === 1 ? '' : 's'} from today's LinkedIn alerts.
      Openings below are drafts — read before sending.
    </p>
    ${jobs.map(card).join('')}
    ${problems}
  </div>`;

const subject = jobs.length
  ? `${jobs.length} job${jobs.length === 1 ? '' : 's'} to apply to — ${jobs[0].Title} at ${jobs[0].Company}`
  : 'LinkedIn job alerts: nothing scored, but something failed';

return [{ json: { subject, html } }];
