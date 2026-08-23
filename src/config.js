import { readFileSync } from 'node:fs';

// Minimal .env loader so the project stays dependency-free.
function loadEnv(path = '.env') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim();
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

loadEnv();

export const config = {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? 'http://localhost:3000/callback',
  port: Number(process.env.PORT ?? 3000),
  // Optional. Lets posting work with a token that only carries w_member_social,
  // where /v2/userinfo is not permitted and the id cannot be looked up.
  personId: process.env.LINKEDIN_PERSON_ID,
  tokenFile: '.tokens.json',
};

// Scopes granted by the two self-serve products:
//   "Sign In with LinkedIn using OpenID Connect" -> openid, profile, email
//   "Share on LinkedIn"                          -> w_member_social
export const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

export function assertConfigured() {
  const missing = ['clientId', 'clientSecret'].filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')} — copy .env.example to .env and fill in the values ` +
        `from https://www.linkedin.com/developers/apps (Auth tab).`
    );
  }
}
