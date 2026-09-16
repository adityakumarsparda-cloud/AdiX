// The dashboard is one self-contained page: the server ships this shell, and the
// page then calls /api/usage itself, so a slow Drive listing or Gmail scan does
// not leave the browser staring at a blank tab.
export const dashboard = (connected, email) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AdiX · Google storage</title>
<style>
  body{font:16px/1.6 system-ui,sans-serif;max-width:52rem;margin:3rem auto;padding:0 1.5rem;color:#111}
  h1{margin-bottom:.2rem} .sub{color:#666;margin-top:0}
  a.btn{display:inline-block;background:#1a73e8;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none}
  button{font:inherit;background:#1a73e8;color:#fff;border:0;padding:.5rem 1rem;border-radius:6px;cursor:pointer}
  button.ghost{background:#eef1f5;color:#111}
  button[disabled]{opacity:.5;cursor:default}
  .bar{display:flex;height:22px;border-radius:6px;overflow:hidden;background:#eef1f5;margin:1rem 0}
  .bar span{display:block}
  table{border-collapse:collapse;width:100%;margin:1rem 0}
  th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid #eceef1;font-size:15px}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .swatch{display:inline-block;width:.75rem;height:.75rem;border-radius:3px;margin-right:.5rem}
  .est{color:#8a6d00;font-size:13px}
  .note{color:#666;font-size:14px}
  .err{background:#fdecea;padding:1rem;border-radius:8px;white-space:pre-wrap;font-size:14px}
  details{margin-top:1.5rem}
</style>
<h1>Google storage by app</h1>
<p class="sub">${connected ? `Connected as ${email ?? 'your Google account'}` : 'Not connected yet'}</p>

${connected
    ? `<p>
        <button id="run">Measure usage</button>
        <label class="note"><input type="checkbox" id="gmail"> also size Gmail (slow — one request per message)</label>
      </p>
      <div id="status" class="note"></div>
      <div id="out"></div>`
    : `<p><a class="btn" href="/auth">Connect Google</a></p>
       <p class="note">Read-only access to Drive metadata and Gmail message sizes. Nothing is written or sent anywhere.</p>`}

<script>
const COLORS = ['#1a73e8','#d93025','#f9ab00','#1e8e3e','#9334e6','#00897b','#5f6368'];
const fmt = (b) => {
  if (b === null || b === undefined) return '—';
  const u = ['B','KB','MB','GB','TB']; let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (v < 10 && i ? v.toFixed(2) : v.toFixed(i ? 1 : 0)) + ' ' + u[i];
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function render(report) {
  const { quota, apps, drive, gmail } = report;
  const scale = quota.limit ?? quota.usage ?? 1;
  const pct = (b) => (scale ? (b / scale) * 100 : 0);

  const bar = '<div class="bar">' + apps.map((a, i) =>
    \`<span style="width:\${pct(a.bytes).toFixed(2)}%;background:\${COLORS[i % COLORS.length]}" title="\${esc(a.name)}"></span>\`
  ).join('') + '</div>';

  const rows = apps.map((a, i) => \`<tr>
      <td><span class="swatch" style="background:\${COLORS[i % COLORS.length]}"></span>\${esc(a.name)}
        \${a.estimated ? '<span class="est"> · estimated</span>' : ''}
        <div class="note">\${esc(a.detail)}</div></td>
      <td class="num">\${fmt(a.bytes)}</td>
      <td class="num">\${quota.limit ? pct(a.bytes).toFixed(1) + '%' : '—'}</td>
    </tr>\`).join('');

  const driveTable = drive ? \`<details open><summary>Inside Drive (\${drive.fileCount} owned files)</summary>
    <table><tr><th>Type</th><th class="num">Files</th><th class="num">Size</th></tr>
    \${drive.categories.map((c) => \`<tr><td>\${esc(c.name)}</td><td class="num">\${c.files}</td><td class="num">\${fmt(c.bytes)}</td></tr>\`).join('')}
    </table>
    <p class="note">In the bin: \${fmt(drive.trashed)} — still counted against the quota until emptied.</p>
    <table><tr><th>Largest files</th><th class="num">Size</th></tr>
    \${drive.largest.map((f) => \`<tr><td>\${esc(f.name)}\${f.trashed ? ' <span class="est">(binned)</span>' : ''}</td><td class="num">\${fmt(f.bytes)}</td></tr>\`).join('')}
    </table></details>\` : '';

  const gmailNote = gmail && gmail.estimated
    ? \`<p class="note">Gmail was sized from \${gmail.scanned} of \${gmail.messagesTotal} messages and scaled up. Raise GOOGLE_GMAIL_SCAN_LIMIT to measure more.</p>\`
    : '';

  document.getElementById('out').innerHTML =
    \`<p><strong>\${fmt(quota.usage)}</strong> used\${quota.limit ? ' of ' + fmt(quota.limit) : ''}\${quota.free !== null ? ' — ' + fmt(quota.free) + ' free' : ''}</p>\`
    + bar
    + '<table><tr><th>App</th><th class="num">Size</th><th class="num">Share</th></tr>' + rows + '</table>'
    + gmailNote + driveTable;
}

document.getElementById('run')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const withGmail = document.getElementById('gmail').checked;
  btn.disabled = true;
  document.getElementById('out').innerHTML = '';
  document.getElementById('status').textContent = withGmail
    ? 'Working… the Gmail scan can take a few minutes.'
    : 'Working…';
  try {
    const res = await fetch('/api/usage?gmail=' + (withGmail ? '1' : '0'));
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    document.getElementById('status').textContent = 'Measured ' + new Date(body.generatedAt).toLocaleString();
    render(body);
  } catch (err) {
    document.getElementById('status').textContent = '';
    document.getElementById('out').innerHTML = '<div class="err">' + esc(err.message) + '</div>';
  } finally {
    btn.disabled = false;
  }
});
</script>`;

export const page = (title, body) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font:16px/1.6 system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1.5rem;color:#111}
  pre{background:#f4f4f5;padding:1rem;border-radius:8px;overflow-x:auto;font-size:14px;white-space:pre-wrap}
  a.btn{display:inline-block;background:#1a73e8;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none}
</style>
<h1>${title}</h1>${body}`;
