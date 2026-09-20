// Terminal version of the dashboard, for when you just want the numbers:
//   node src/google/report.js [--gmail] [--json]
// Authorization still happens in the browser once, via `npm run google`.
import { assertConfigured } from './config.js';
import { getAccessToken } from './oauth.js';
import { buildReport, formatBytes } from './usage.js';

assertConfigured();

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');

const report = await buildReport(await getAccessToken(), {
  includeGmail: args.has('--gmail'),
  onProgress: (message) => {
    if (!asJson) process.stderr.write(`\r${message.padEnd(60)}`);
  },
});

if (!asJson) process.stderr.write('\r'.padEnd(62) + '\r');

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const { quota, apps, drive } = report;
  console.log(`\n${report.account.emailAddress ?? 'account'} — ${formatBytes(quota.usage)} used` +
    (quota.limit ? ` of ${formatBytes(quota.limit)}` : ''));
  console.log('');

  const width = Math.max(...apps.map((a) => a.name.length));
  for (const app of apps) {
    const share = quota.limit ? (app.bytes / quota.limit) * 100 : 0;
    const bar = '█'.repeat(Math.round(share / 2.5)).padEnd(40, '·');
    console.log(
      `${app.name.padEnd(width)}  ${formatBytes(app.bytes).padStart(9)}  ${bar}` +
        `${quota.limit ? ` ${share.toFixed(1)}%` : ''}${app.estimated ? '  (estimated)' : ''}`
    );
  }

  if (drive) {
    console.log('\nInside Drive:');
    for (const category of drive.categories) {
      console.log(`  ${category.name.padEnd(18)} ${formatBytes(category.bytes).padStart(9)}  ${category.files} files`);
    }
    console.log(`  ${'In the bin'.padEnd(18)} ${formatBytes(drive.trashed).padStart(9)}`);
  }
  console.log('');
}
