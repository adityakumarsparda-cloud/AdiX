import { readFileSync, writeFileSync } from 'node:fs';
import { config, SCOPES } from './config.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function buildAuthorizeUrl(state) {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES.join(' '),
    state,
    // A refresh token is only issued with access_type=offline, and Google
    // re-issues one only when consent is shown again — so ask for both.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  }).toString();
  return url.toString();
}

async function postToken(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params,
    }).toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`token request failed (${res.status}): ${text}`);
  return JSON.parse(text);
}

export function exchangeCodeForToken(code) {
  return postToken({ code, grant_type: 'authorization_code', redirect_uri: config.redirectUri });
}

/** Pulls the account's email out of the id_token, for display only. */
function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return payload.email;
  } catch {
    return undefined;
  }
}

export function saveTokens(raw, previous) {
  const tokens = {
    ...raw,
    email: (raw.id_token && emailFromIdToken(raw.id_token)) ?? previous?.email,
    // A refresh exchange omits refresh_token, so carry the stored one forward
    // rather than dropping it and forcing a re-authorization on every expiry.
    refresh_token: raw.refresh_token ?? previous?.refresh_token,
    expires_at: new Date(Date.now() + Number(raw.expires_in ?? 0) * 1000).toISOString(),
  };
  writeFileSync(config.tokenFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  return tokens;
}

export function loadTokens() {
  try {
    return JSON.parse(readFileSync(config.tokenFile, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Access tokens last an hour. Refresh a minute early so a long scan that starts
// just before expiry does not fail halfway through.
const EXPIRY_MARGIN_MS = 60_000;

/** Returns a usable access token, refreshing it first when it is about to expire. */
export async function getAccessToken() {
  const tokens = loadTokens();
  if (!tokens) throw new Error('Not connected. Visit /auth first.');

  const expiresAt = Date.parse(tokens.expires_at ?? 0);
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > EXPIRY_MARGIN_MS) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error('Access token expired and no refresh token was stored. Re-run /auth.');
  }

  const refreshed = saveTokens(
    await postToken({ refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }),
    tokens
  );
  return refreshed.access_token;
}
