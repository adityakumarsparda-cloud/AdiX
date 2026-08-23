import { readFileSync, writeFileSync } from 'node:fs';
import { config, SCOPES } from './config.js';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const POSTS_URL = 'https://api.linkedin.com/rest/posts';

// Every /rest/ endpoint requires a LinkedIn-Version: YYYYMM header, and LinkedIn
// retires versions after roughly a year. Rather than hardcode one that quietly
// expires, try the current month and walk backwards until one is accepted.
const VERSION_LOOKBACK_MONTHS = 15;

function candidateVersions() {
  if (process.env.LINKEDIN_API_VERSION) return [process.env.LINKEDIN_API_VERSION];

  const now = new Date();
  const versions = [];
  for (let back = 0; back < VERSION_LOOKBACK_MONTHS; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    versions.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return versions;
}

/**
 * POST to a versioned endpoint, retrying with an older LinkedIn-Version when the
 * server reports the requested one is not active. A 426 is rejected before the
 * request is processed, so retrying cannot create a duplicate post.
 */
export async function postVersioned(url, accessToken, body) {
  let lastError;

  for (const version of candidateVersions()) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': version,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) return { res, version };

    const text = await res.text();
    if (res.status === 426 && text.includes('NONEXISTENT_VERSION')) {
      lastError = `version ${version} not active`;
      continue;
    }
    throw new Error(`post failed (${res.status}): ${text}`);
  }

  throw new Error(
    `No supported LinkedIn-Version found (last: ${lastError}). ` +
      `Set LINKEDIN_API_VERSION in .env to a version listed at ` +
      `https://learn.microsoft.com/linkedin/marketing/versioning`
  );
}

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
  const { res, version } = await postVersioned(POSTS_URL, accessToken, {
    author: `urn:li:person:${personId}`,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  });
  return { id: res.headers.get('x-restli-id'), version };
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
