import { readFileSync, writeFileSync } from 'node:fs';
import { config, SCOPES } from './config.js';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const POSTS_URL = 'https://api.linkedin.com/rest/posts';

// Required on every /rest/ endpoint. Format is YYYYMM; LinkedIn retires old
// versions roughly yearly, so bump this when calls start 426-ing.
const LINKEDIN_VERSION = '202506';

/** Step 1: the URL we send the user to so they can approve access. */
export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: SCOPES.join(' '),
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/** Step 4: trade the short-lived code for an access token, server-to-server. */
export async function exchangeCodeForToken(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${body.error_description ?? JSON.stringify(body)}`
    );
  }
  return body;
}

export async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Publish a text post to the signed-in member's feed. Needs w_member_social. */
export async function createTextPost(accessToken, personId, text) {
  const res = await fetch(POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`post failed (${res.status}): ${await res.text()}`);
  }
  return { id: res.headers.get('x-restli-id') };
}

export function saveTokens(data) {
  const record = {
    ...data,
    obtained_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
  writeFileSync(config.tokenFile, JSON.stringify(record, null, 2));
  return record;
}

export function loadTokens() {
  try {
    return JSON.parse(readFileSync(config.tokenFile, 'utf8'));
  } catch {
    return null;
  }
}
