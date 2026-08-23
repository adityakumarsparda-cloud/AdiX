import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// The project root is the parent of src/, so .env resolves the same way no
// matter which directory the process was started from.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(projectRoot, '.env');

// Minimal .env loader so the project stays dependency-free.
function loadEnv(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  // Editors on Windows often write a UTF-8 BOM, which would otherwise become
  // part of the first key name and make that variable silently unreadable.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    // Tolerate values that were pasted with surrounding quotes.
    const value = trimmed.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(envPath);

export const config = {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? 'http://localhost:3000/callback',
  port: Number(process.env.PORT ?? 3000),
  // Optional. Lets posting work with a token that only carries w_member_social,
  // where /v2/userinfo is not permitted and the id cannot be looked up.
  personId: process.env.LINKEDIN_PERSON_ID,
  tokenFile: join(projectRoot, '.tokens.json'),
};

// Scopes granted by the two self-serve products:
//   "Sign In with LinkedIn using OpenID Connect" -> openid, profile, email
//   "Share on LinkedIn"                          -> w_member_social
export const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

/** Names a likely .env mistake, so the failure says what to actually do. */
function diagnoseEnvFile() {
  if (existsSync(envPath)) {
    return `Found ${envPath}, but LINKEDIN_CLIENT_ID and/or LINKEDIN_CLIENT_SECRET are blank in it.`;
  }

  const lookalikes = readdirSync(projectRoot).filter(
    (name) => name !== '.env' && name.toLowerCase().replace(/\s+/g, '').startsWith('.env')
  );

  if (lookalikes.includes('.env.txt')) {
    return (
      `Found ".env.txt" but not ".env". Windows hides file extensions by default, so ` +
      `the editor appended .txt. Turn on View > "File name extensions" in Explorer, ` +
      `then rename ".env.txt" to ".env".`
    );
  }
  if (lookalikes.length) {
    return `No ".env" file in ${projectRoot}. Found instead: ${lookalikes.join(', ')}. Rename one of these to exactly ".env".`;
  }
  return `No ".env" file in ${projectRoot}. Copy ".env.example" to ".env" and fill it in.`;
}

export function assertConfigured() {
  const missing = ['clientId', 'clientSecret'].filter((k) => !config[k]);
  if (!missing.length) return;

  throw new Error(
    `Missing ${missing.join(' and ')}.\n\n` +
      `  ${diagnoseEnvFile()}\n\n` +
      `  Get the values from https://www.linkedin.com/developers/apps -> your app -> Auth tab.\n` +
      `  The file should contain lines like:\n\n` +
      `    LINKEDIN_CLIENT_ID=86uuurh8t9va7w\n` +
      `    LINKEDIN_CLIENT_SECRET=your_secret_here\n`
  );
}
