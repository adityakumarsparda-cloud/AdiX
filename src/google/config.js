import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, projectRoot, envPath } from '../env.js';

loadEnv(envPath);

const port = Number(process.env.GOOGLE_PORT ?? 3100);

export const config = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Follows GOOGLE_PORT by default, so changing the port does not silently
  // leave the redirect pointing at a server that is no longer there.
  redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${port}/callback`,
  port,
  // Gmail has no "how big is my mailbox" endpoint, so size is summed one message
  // at a time. This caps that scan; beyond it the total is extrapolated.
  gmailScanLimit: Number(process.env.GOOGLE_GMAIL_SCAN_LIMIT ?? 2000),
  tokenFile: join(projectRoot, '.google-tokens.json'),
};

// Read-only throughout. gmail.metadata is deliberately narrower than
// gmail.readonly: it exposes each message's headers and sizeEstimate but never
// the body, which is all this app needs to size a mailbox.
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
];

export function assertConfigured() {
  const missing = ['clientId', 'clientSecret'].filter((k) => !config[k]);
  if (!missing.length) return;

  const envHint = existsSync(envPath)
    ? `Found ${envPath}, but ${missing.join(' and ')} are blank in it.`
    : `No ".env" file in ${projectRoot}. Copy ".env.example" to ".env" and fill it in.`;

  throw new Error(
    `Missing ${missing.join(' and ')}.\n\n` +
      `  ${envHint}\n\n` +
      `  Create an OAuth client at https://console.cloud.google.com/apis/credentials\n` +
      `  (type "Web application"), enable the Drive API and the Gmail API, and add\n` +
      `  ${config.redirectUri} as an authorized redirect URI. Then set:\n\n` +
      `    GOOGLE_CLIENT_ID=...apps.googleusercontent.com\n` +
      `    GOOGLE_CLIENT_SECRET=your_secret_here\n`
  );
}
