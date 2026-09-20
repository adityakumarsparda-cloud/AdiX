import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { config, assertConfigured } from './config.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  saveTokens,
  loadTokens,
  getAccessToken,
} from './oauth.js';
import { buildReport } from './usage.js';
import { dashboard, page } from './ui.js';

assertConfigured();

// state values we have issued but not yet seen come back (CSRF protection).
const pendingStates = new Set();

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

const routes = {
  '/': (_url, res) => {
    const tokens = loadTokens();
    sendHtml(res, 200, dashboard(Boolean(tokens), tokens?.email));
  },

  '/auth': (_url, res) => {
    const state = randomBytes(16).toString('hex');
    pendingStates.add(state);
    res.writeHead(302, { Location: buildAuthorizeUrl(state) });
    res.end();
  },

  '/callback': async (url, res) => {
    const error = url.searchParams.get('error');
    if (error) return sendHtml(res, 400, page('Authorization denied', `<pre>${error}</pre>`));

    const state = url.searchParams.get('state');
    if (!state || !pendingStates.delete(state)) {
      return sendHtml(res, 400, page('Bad state', '<p>state did not match a request we issued — possible CSRF. Start again at <a href="/">/</a>.</p>'));
    }

    const code = url.searchParams.get('code');
    if (!code) return sendHtml(res, 400, page('Missing code', '<p>No <code>code</code> in the callback.</p>'));

    saveTokens(await exchangeCodeForToken(code), loadTokens());
    res.writeHead(302, { Location: '/' });
    res.end();
  },

  '/api/usage': async (url, res) => {
    const accessToken = await getAccessToken();
    const report = await buildReport(accessToken, {
      includeDrive: url.searchParams.get('drive') !== '0',
      includeGmail: url.searchParams.get('gmail') === '1',
    });
    sendJson(res, 200, report);
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.port}`);
  const handler = routes[url.pathname];
  if (!handler) return sendHtml(res, 404, page('Not found', '<p><a href="/">Back</a></p>'));

  try {
    await handler(url, res);
  } catch (err) {
    if (url.pathname.startsWith('/api/')) return sendJson(res, 500, { error: err.message });
    sendHtml(res, 500, page('Error', `<pre>${err.message}</pre><p><a href="/">Back</a></p>`));
  }
});

server.listen(config.port, () => {
  console.log(`Google storage dashboard on http://localhost:${config.port}`);
});
