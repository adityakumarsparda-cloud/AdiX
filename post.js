// Publishes the contents of post.txt to your LinkedIn feed.
//
//   node post.js            preview only, sends nothing
//   node post.js --publish  actually posts
//
// Reads the token saved by the OAuth flow in .tokens.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { config } from './src/config.js';
import { fetchUserInfo, createTextPost, loadTokens } from './src/linkedin.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const publish = process.argv.includes('--publish');

const tokens = loadTokens();
if (!tokens) {
  console.error('No .tokens.json found. Start the server and connect LinkedIn first.');
  process.exit(1);
}

let text;
try {
  text = readFileSync(join(projectRoot, 'post.txt'), 'utf8').replace(/^﻿/, '').trimEnd();
} catch {
  console.error('No post.txt found. Put the text you want to publish in post.txt.');
  process.exit(1);
}

if (!text) {
  console.error('post.txt is empty.');
  process.exit(1);
}
if (text.length > 3000) {
  console.error(`post.txt is ${text.length} characters; LinkedIn's limit is 3000.`);
  process.exit(1);
}

console.log('\n' + '-'.repeat(60));
console.log(text);
console.log('-'.repeat(60));
console.log(`${text.length} characters\n`);

if (!publish) {
  console.log('Preview only. Nothing was sent.');
  console.log('Run "node post.js --publish" to post this to your feed.\n');
  process.exit(0);
}

function explain(err) {
  const message = err.message ?? String(err);
  if (/REVOKED_ACCESS_TOKEN/.test(message)) {
    return 'That token has been revoked. Run the server again and reconnect LinkedIn to get a new one.';
  }
  if (/EXPIRED_ACCESS_TOKEN|expired/i.test(message)) {
    return `That token expired (it was valid until ${tokens.expires_at}). Reconnect LinkedIn to get a new one.`;
  }
  if (/Not enough permissions|ACCESS_DENIED/.test(message)) {
    return 'The token is missing the w_member_social scope needed to post. Reconnect LinkedIn and approve posting.';
  }
  return message;
}

try {
  const me = await fetchUserInfo(tokens.access_token).catch((err) => {
    if (config.personId) return { sub: config.personId };
    throw err;
  });

  const { id, version } = await createTextPost(tokens.access_token, me.sub, text);
  console.log(`Posted as ${me.name ?? me.sub} (API version ${version}).`);
  console.log(`Post id: ${id}`);
  console.log(`View it at https://www.linkedin.com/feed/update/${id}\n`);
} catch (err) {
  console.error(`\nCould not post: ${explain(err)}\n`);
  process.exit(1);
}
