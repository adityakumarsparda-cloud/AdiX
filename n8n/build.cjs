// Build the importable n8n workflow from the sources in lib/ and profile.md.
//
//   node build.cjs        -> writes job-alerts.workflow.json
//
// The code nodes live as real .js files so they can be read and reviewed; this
// script inlines them (and the candidate profile) into the workflow JSON that
// n8n imports. Edit lib/*.js or profile.md, never the generated JSON.
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const profile = read('profile.md')
  // Drop the file's own front matter; only the profile body goes to Claude.
  .replace(/^[\s\S]*?## Target roles/, '## Target roles');

const parseAndFilter = read('lib/parse-and-filter.js')
  .replace('__PROFILE__', JSON.stringify(profile));

const pos = (x, y) => [x, y];

const workflow = {
  name: 'LinkedIn job alerts to application drafts',
  settings: { executionOrder: 'v1' },
  nodes: [
    {
      id: 'gmail-trigger',
      name: 'Gmail Trigger',
      type: 'n8n-nodes-base.gmailTrigger',
      typeVersion: 1,
      position: pos(-620, 300),
      parameters: {
        pollTimes: { item: [{ mode: 'everyX', value: 15, unit: 'minutes' }] },
        simple: false,
        filters: {
          q: 'from:jobalerts-noreply@linkedin.com newer_than:2d',
          readStatus: 'unread',
        },
        options: {},
      },
      credentials: { gmailOAuth2: { id: 'REPLACE_ME', name: 'Gmail account' } },
    },
    {
      id: 'load-tracker',
      name: 'Load tracker',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      position: pos(-400, 300),
      // An empty sheet returns no rows; without this the run would stop here on
      // the very first execution.
      alwaysOutputData: true,
      parameters: {
        documentId: { __rl: true, value: 'REPLACE_WITH_SHEET_ID', mode: 'id' },
        sheetName: { __rl: true, value: 'Applications', mode: 'name' },
        options: {},
      },
      credentials: {
        googleSheetsOAuth2Api: { id: 'REPLACE_ME', name: 'Google Sheets account' },
      },
    },
    {
      id: 'parse-and-filter',
      name: 'Parse and filter',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos(-180, 300),
      parameters: { mode: 'runOnceForAllItems', jsCode: parseAndFilter },
    },
    {
      id: 'score-fit',
      name: 'Score fit',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: pos(40, 300),
      parameters: {
        method: 'POST',
        url: 'https://api.anthropic.com/v1/messages',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'anthropic-version', value: '2023-06-01' },
            { name: 'content-type', value: 'application/json' },
          ],
        },
        sendBody: true,
        specifyBody: 'json',
        // The request body is assembled in 'Parse and filter' so the prompt is
        // plain JavaScript rather than escaped JSON inside this parameter.
        jsonBody: '={{ JSON.stringify($json.claudeBody) }}',
        options: {
          timeout: 120000,
          batching: { batch: { batchSize: 3, batchInterval: 1000 } },
        },
      },
      credentials: {
        httpHeaderAuth: { id: 'REPLACE_ME', name: 'Anthropic x-api-key' },
      },
    },
    {
      id: 'read-scores',
      name: 'Read scores',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos(260, 300),
      parameters: { mode: 'runOnceForAllItems', jsCode: read('lib/score-parse.js') },
    },
    {
      id: 'append-tracker',
      name: 'Append to tracker',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      position: pos(480, 300),
      parameters: {
        operation: 'append',
        documentId: { __rl: true, value: 'REPLACE_WITH_SHEET_ID', mode: 'id' },
        sheetName: { __rl: true, value: 'Applications', mode: 'name' },
        columns: {
          mappingMode: 'autoMapInputData',
          value: {},
          matchingColumns: [],
          schema: [],
        },
        options: {},
      },
      credentials: {
        googleSheetsOAuth2Api: { id: 'REPLACE_ME', name: 'Google Sheets account' },
      },
    },
    {
      id: 'build-digest',
      name: 'Build digest',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos(700, 300),
      parameters: { mode: 'runOnceForAllItems', jsCode: read('lib/build-digest.js') },
    },
    {
      id: 'send-digest',
      name: 'Send digest',
      type: 'n8n-nodes-base.gmail',
      typeVersion: 2.1,
      position: pos(920, 300),
      parameters: {
        sendTo: 'adityakumar.sparda@gmail.com',
        subject: '={{ $json.subject }}',
        emailType: 'html',
        message: '={{ $json.html }}',
        options: { appendAttribution: false },
      },
      credentials: { gmailOAuth2: { id: 'REPLACE_ME', name: 'Gmail account' } },
    },
  ],
  connections: {},
  pinData: {},
};

const chain = [
  'Gmail Trigger', 'Load tracker', 'Parse and filter', 'Score fit',
  'Read scores', 'Append to tracker', 'Build digest', 'Send digest',
];
chain.slice(0, -1).forEach((from, i) => {
  workflow.connections[from] = {
    main: [[{ node: chain[i + 1], type: 'main', index: 0 }]],
  };
});

const out = path.join(__dirname, 'job-alerts.workflow.json');
fs.writeFileSync(out, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`wrote ${path.basename(out)}`);
