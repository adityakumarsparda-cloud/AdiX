// n8n Code node: "Parse and filter"  (mode: Run Once for All Items)
//
// Input : one item per LinkedIn job-alert email from the Gmail Trigger.
// Output: one item per job that matches the target roles and is not already in
//         the tracker sheet, carrying a ready-to-send Claude request body.
//
// Reads two upstream nodes by name:
//   $('Gmail Trigger')  - the alert emails
//   $('Load tracker')   - every row already in the Google Sheet
// Rename either node in the canvas and you must rename it here too.

const PROFILE = __PROFILE__;

// A job must match one of these to survive.
const WANTED = [
  /\b(d2c|direct[- ]to[- ]consumer|e-?commerce|ecom)\b[\s\S]{0,30}\boperations?\b/i,
  /\boperations?\b[\s\S]{0,30}\b(d2c|direct[- ]to[- ]consumer|e-?commerce|ecom)\b/i,
  /\bsupply chain\b[\s\S]{0,30}\b(manager|lead|head|specialist)\b/i,
  /\b(manager|lead|head)\b[\s\S]{0,30}\bsupply chain\b/i,
];

// ...and must not match any of these. Seniority guards on both ends: roles far
// below the current one are a step back, roles far above will not shortlist.
const REJECT = [
  /\b(intern|internship|trainee|apprentice|fresher)\b/i,
  /\b(executive assistant|assistant to)\b/i,
  /\b(vp|vice president|director|cxo|chief)\b/i,
  /\b(driver|picker|packer|loader|helper)\b/i,
];

const decodeEntities = (s) => s
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&(middot|bull);/g, '·')
  .replace(/&(ndash|mdash);/g, '-')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]*>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

// The Gmail node returns the body in a different shape depending on its version
// and its "format" option, so look in every place it might be.
function extractHtml(item) {
  const j = item.json || {};
  if (typeof j.html === 'string' && j.html) return j.html;
  if (typeof j.textAsHtml === 'string' && j.textAsHtml) return j.textAsHtml;

  const fromB64 = (data) => Buffer
    .from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    .toString('utf8');

  const walk = (part) => {
    if (!part) return '';
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      return fromB64(part.body.data);
    }
    for (const child of part.parts || []) {
      const found = walk(child);
      if (found) return found;
    }
    return '';
  };
  const fromPayload = walk(j.payload);
  if (fromPayload) return fromPayload;

  if (typeof j.text === 'string' && j.text) return j.text;
  return '';
}

// LinkedIn alert emails link each job as /jobs/view/<id> (usually under the
// /comm/ tracking prefix) with the job title as the anchor text. The company
// name sits in the markup just after the anchor, which is the fragile part of
// this parser - check this node's output on the first real run.
function parseJobs(html) {
  const jobs = [];
  const anchor = /<a\b[^>]*href="([^"]*?\/jobs\/view\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchor.exec(html)) !== null) {
    const title = stripTags(m[3]);
    if (!title || /^(view|apply|see|show)\b/i.test(title)) continue;

    // Stop at the next job link so one posting cannot swallow the next one's
    // text, backing up to that link's opening tag so no half tag survives.
    const nextLink = html.indexOf('/jobs/view/', anchor.lastIndex);
    const end = nextLink === -1
      ? Math.min(anchor.lastIndex + 800, html.length)
      : Math.max(html.lastIndexOf('<', nextLink), anchor.lastIndex);
    const [company = '', location = ''] = stripTags(html.slice(anchor.lastIndex, end))
      .split('·')
      .map((s) => s.trim())
      .filter((s) => s && !/^(view|see|apply|show)\b/i.test(s));

    jobs.push({
      jobId: m[2],
      title,
      company: company.slice(0, 120),
      location: location.slice(0, 120),
      // Drop the tracking query string; the bare permalink is what gets stored.
      url: `https://www.linkedin.com/jobs/view/${m[2]}/`,
    });
  }
  return jobs;
}

function wanted(title) {
  if (REJECT.some((re) => re.test(title))) return false;
  return WANTED.some((re) => re.test(title));
}

function claudeBody(job) {
  const system = [
    'You screen job postings for one candidate and draft the opening of an',
    'application note. Judge fit only from the candidate profile below.',
    '',
    'Rules you must not break:',
    '- Use only facts stated in the profile. Never invent an employer, a metric,',
    '  a tool, a certification, or a responsibility that is not written there.',
    '- If the posting needs something the profile does not show, put it in gaps',
    '  rather than papering over it.',
    '- You are given only the job title, company and location, not the full job',
    '  description. Score what those support and no more; when the title is',
    '  ambiguous, score it lower rather than guessing generously.',
    '- The opening is at most 120 words, first person, plain sentences, no',
    '  greeting and no sign-off.',
    '',
    '--- CANDIDATE PROFILE ---',
    PROFILE,
  ].join('\n');

  const user = [
    `Job title: ${job.title}`,
    `Company: ${job.company || 'unknown'}`,
    `Location: ${job.location || 'unknown'}`,
    `Posting: ${job.url}`,
  ].join('\n');

  return {
    model: 'claude-opus-5',
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: {
      // Triage, not deep reasoning - low effort keeps the per-job cost down.
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            fit_score: { type: 'integer', minimum: 1, maximum: 10 },
            verdict: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            gaps: { type: 'array', items: { type: 'string' } },
            opening: { type: 'string' },
          },
          required: ['fit_score', 'verdict', 'strengths', 'gaps', 'opening'],
          additionalProperties: false,
        },
      },
    },
  };
}

// Every job id the tracker has already seen, whatever the column is called.
const seen = new Set(
  $('Load tracker').all()
    .map((row) => String((row.json || {}).JobId ?? (row.json || {}).jobId ?? '').trim())
    .filter(Boolean),
);

const out = [];
for (const email of $('Gmail Trigger').all()) {
  for (const job of parseJobs(extractHtml(email))) {
    if (seen.has(job.jobId)) continue;   // already tracked
    if (!wanted(job.title)) continue;    // not a target role
    seen.add(job.jobId);                 // and not twice within this batch
    out.push({ json: { ...job, claudeBody: claudeBody(job) } });
  }
}

return out;
