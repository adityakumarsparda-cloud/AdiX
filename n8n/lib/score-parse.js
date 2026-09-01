// n8n Code node: "Read scores"  (mode: Run Once for All Items)
//
// Turns each Claude response into one flat row matching the tracker sheet's
// column headers, and drops anything below the score threshold.
//
// The HTTP Request node replaces the item body with Claude's response, so the
// job fields are read back from 'Parse and filter' by index - the HTTP node
// emits one item per input item, in order.

const MIN_SCORE = 7;

const responses = $input.all();
const jobs = $('Parse and filter').all();

const today = new Date().toISOString().slice(0, 10);
const rows = [];

// Keep failures in the same column shape as scored rows, so the tracker never
// gets a half-empty row and the digest can still report what went wrong.
const failed = (job, error) => ({
  json: {
    Date: today,
    Company: job.company || '',
    Title: job.title || '',
    Location: job.location || '',
    JobId: job.jobId || '',
    URL: job.url || '',
    FitScore: '',
    Verdict: '',
    Gaps: '',
    Opening: '',
    Status: 'scoring failed',
    error,
  },
});

responses.forEach((res, i) => {
  const job = (jobs[i] || {}).json || {};
  const body = res.json || {};

  // With thinking on, the JSON answer is not always the first content block.
  const blocks = Array.isArray(body.content) ? body.content : [];
  const text = blocks.filter((b) => b && b.type === 'text').map((b) => b.text).join('');

  // Surfaced in the digest rather than silently dropped.
  if (body.stop_reason === 'refusal' || !text) {
    rows.push(failed(job, `no usable response (stop_reason: ${body.stop_reason || 'none'})`));
    return;
  }

  let scored;
  try {
    scored = JSON.parse(text);
  } catch (e) {
    rows.push(failed(job, `unparseable response: ${text.slice(0, 200)}`));
    return;
  }

  if (Number(scored.fit_score) < MIN_SCORE) return;

  rows.push({
    json: {
      Date: today,
      Company: job.company || '',
      Title: job.title || '',
      Location: job.location || '',
      JobId: job.jobId || '',
      URL: job.url || '',
      FitScore: Number(scored.fit_score),
      Verdict: String(scored.verdict || ''),
      Gaps: (scored.gaps || []).join('; '),
      Opening: String(scored.opening || ''),
      Status: 'ready',
    },
  });
});

// Best first, so the digest leads with the roles worth opening.
return rows.sort((a, b) => (b.json.FitScore || 0) - (a.json.FitScore || 0));
