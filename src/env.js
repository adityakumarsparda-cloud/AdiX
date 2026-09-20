import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// The project root is the parent of src/, so .env resolves the same way no
// matter which directory the process was started from.
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const envPath = join(projectRoot, '.env');

// Minimal .env loader so the project stays dependency-free.
export function loadEnv(path = envPath) {
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
