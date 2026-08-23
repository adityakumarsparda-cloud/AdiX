import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { config, assertConfigured } from './config.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchUserInfo,
  createTextPost,
  saveTokens,
  loadTokens,
} from './linkedin.js';

assertConfigured();

// state values we have issued but not yet seen come back (CSRF protection).
const pendingStates = new Set();

const page = (title, body) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font:16px/1.6 system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1.5rem;color:#111}
  pre{background:#f4f4f5;padding:1rem;border-radius:8px;overflow-x:auto;font-size:14px}
  a.btn{display:inline-block;background:#0a66c2;color:#fff;padding:.7rem 1.2rem;border-radius:6px;text-decoration:none}
  code{background:#f4f4f5;padding:.15rem .35rem;border-radius:4px}
</style>
<h1>${title}</h1>${body}`;

function send(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

const routes = {
  '/': (_url, res) => {
    const tokens = loadTokens();
    send(res, 200, page('AdiX · LinkedIn OAuth', `
      <p>Status: ${tokens ? `token stored, expires <strong>${tokens.expires_at}</strong>` : '<strong>not connected</strong>'}</p>
      <p><a class="btn" href="/auth">${tokens ? 'Re-connect' : 'Connect'} LinkedIn</a></p>
      <p>Then try <a href="/me">/me</a> to read your profile.</p>`));
  },

  '/auth': (_url, res) => {
    const state = randomBytes(16).toString('hex');
    pendingStates.add(state);
    res.writeHead(302, { Location: buildAuthorizeUrl(state) });
    res.end();
  },

  '/callback': async (url, res) => {
    const error = url.searchParams.get('error');
    if (error) {
      const detail = url.searchParams.get('error_description') ?? '';
      return send(res, 400, page('Authorization denied', `<pre>${error}\n${detail}</pre>`));
    }

    const state = url.searchParams.get('state');
    if (!state || !pendingStates.delete(state)) {
      return send(res, 400, page('Bad state', '<p>state did not match a request we issued — possible CSRF. Start again at <a href="/">/</a>.</p>'));
    }

    const code = url.searchParams.get('code');
    if (!code) return send(res, 400, page('Missing code', '<p>No <code>code</code> in the callback.</p>'));

    const tokens = saveTokens(await exchangeCodeForToken(code));
    const me = await fetchUserInfo(tokens.access_token);

    send(res, 200, page('Connected', `
      <p>Access token saved to <code>${config.tokenFile}</code> (git-ignored), valid until <strong>${tokens.expires_at}</strong>.</p>
      <h2>Your profile</h2><pre>${JSON.stringify(me, null, 2)}</pre>
      <p>Your person URN is <code>urn:li:person:${me.sub}</code> — that is the <code>author</code> value for posting.</p>
      <p><a href="/">Back</a></p>`));
  },

  '/me': async (_url, res) => {
    const tokens = loadTokens();
    if (!tokens) return send(res, 401, page('Not connected', '<p><a href="/auth">Connect LinkedIn</a> first.</p>'));
    const me = await fetchUserInfo(tokens.access_token);
    send(res, 200, page('Your profile', `<pre>${JSON.stringify(me, null, 2)}</pre><p><a href="/">Back</a></p>`));
  },

  // Demo only: GET /post?text=Hello. A real app would POST with a CSRF token.
  '/post': async (url, res) => {
    const tokens = loadTokens();
    if (!tokens) return send(res, 401, page('Not connected', '<p><a href="/auth">Connect LinkedIn</a> first.</p>'));
    const text = url.searchParams.get('text');
    if (!text) return send(res, 400, page('Missing text', '<p>Use <code>/post?text=Hello%20world</code>.</p>'));

    const me = await fetchUserInfo(tokens.access_token);
    const { id } = await createTextPost(tokens.access_token, me.sub, text);
    send(res, 200, page('Posted', `<p>Post id <code>${id}</code></p><p><a href="/">Back</a></p>`));
  },
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.port}`);
  const handler = routes[url.pathname];
  if (!handler) return send(res, 404, page('Not found', '<p><a href="/">Back</a></p>'));

  try {
    await handler(url, res);
  } catch (err) {
    console.error(err);
    send(res, 500, page('Error', `<pre>${err.message}</pre><p><a href="/">Back</a></p>`));
  }
}).listen(config.port, () => {
  console.log(`\n  AdiX LinkedIn OAuth demo`);
  console.log(`  open http://localhost:${config.port}`);
  console.log(`  redirect_uri in use: ${config.redirectUri}`);
  console.log(`  (this must be listed under Authorized redirect URLs in your app's Auth tab)\n`);
});
