import { fetchAbout, fetchOwnedFiles, fetchGmailProfile, scanGmailSize } from './api.js';
import { config } from './config.js';

// Google's own editor formats are stored outside the quota, so they show up
// with quotaBytesUsed = 0. They are still listed, because "Docs takes no space"
// is itself the answer to "which app uses how much".
const GOOGLE_APPS = {
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.form': 'Google Forms',
  'application/vnd.google-apps.drawing': 'Google Drawings',
  'application/vnd.google-apps.script': 'Apps Script',
  'application/vnd.google-apps.jam': 'Jamboard',
  'application/vnd.google-apps.site': 'Google Sites',
  'application/vnd.google-apps.map': 'My Maps',
  'application/vnd.google-apps.shortcut': 'Shortcuts',
  'application/vnd.google-apps.folder': 'Folders',
};

const OFFICE = /^application\/(vnd\.openxmlformats-officedocument|vnd\.ms-|msword|rtf)/;

/** Buckets one Drive file under the app or file type that produced it. */
export function classify(mimeType = '') {
  if (GOOGLE_APPS[mimeType]) return GOOGLE_APPS[mimeType];
  if (mimeType === 'application/pdf') return 'PDFs';
  if (OFFICE.test(mimeType)) return 'Office files';
  if (mimeType.startsWith('video/')) return 'Videos';
  if (mimeType.startsWith('image/')) return 'Images in Drive';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.startsWith('text/')) return 'Text and code';
  if (/zip|tar|gzip|rar|7z/.test(mimeType)) return 'Archives';
  return 'Other files';
}

const bytesOf = (file) => Number(file.quotaBytesUsed ?? file.size ?? 0);

/** Drive broken down by the app or file type each byte belongs to. */
export function summarizeDrive(files) {
  const buckets = new Map();
  let total = 0;
  let trashed = 0;

  for (const file of files) {
    const bytes = bytesOf(file);
    total += bytes;
    if (file.trashed) trashed += bytes;

    const name = classify(file.mimeType);
    const bucket = buckets.get(name) ?? { name, bytes: 0, files: 0 };
    bucket.bytes += bytes;
    bucket.files += 1;
    buckets.set(name, bucket);
  }

  const largest = files
    .filter((f) => bytesOf(f) > 0)
    .sort((a, b) => bytesOf(b) - bytesOf(a))
    .slice(0, 20)
    .map((f) => ({
      name: f.name,
      bytes: bytesOf(f),
      category: classify(f.mimeType),
      trashed: Boolean(f.trashed),
      modifiedTime: f.modifiedTime,
    }));

  return {
    total,
    trashed,
    fileCount: files.length,
    categories: [...buckets.values()].sort((a, b) => b.bytes - a.bytes),
    largest,
  };
}

/**
 * Builds the whole picture. `drive` and `gmail` are optional because the Drive
 * listing and especially the Gmail scan are slow, while the headline quota
 * numbers come back in a single request.
 */
export async function buildReport(accessToken, { includeDrive = true, includeGmail = false, onProgress = () => {} } = {}) {
  onProgress('Reading storage quota…');
  const about = await fetchAbout(accessToken);
  const quota = about.storageQuota ?? {};

  const usage = Number(quota.usage ?? 0);
  const limit = quota.limit === undefined ? null : Number(quota.limit);
  const driveUsage = Number(quota.usageInDrive ?? 0);

  let drive = null;
  if (includeDrive) {
    onProgress('Listing Drive files…');
    drive = summarizeDrive(await fetchOwnedFiles(accessToken, {
      onProgress: (n) => onProgress(`Listing Drive files… ${n} so far`),
    }));
  }

  let gmail = null;
  if (includeGmail) {
    onProgress('Sizing the mailbox…');
    const profile = await fetchGmailProfile(accessToken);
    const messagesTotal = Number(profile.messagesTotal ?? 0);
    const { bytes, scanned } = await scanGmailSize(accessToken, {
      limit: config.gmailScanLimit,
      onProgress: (done, total) => onProgress(`Sizing the mailbox… ${done}/${total} messages`),
    });

    // sizeEstimate is per-message and the scan may be capped, so scale what was
    // measured up to the full mailbox and say plainly that the result is an
    // estimate rather than presenting it as a measured total.
    const complete = scanned >= messagesTotal;
    gmail = {
      bytes: complete || scanned === 0 ? bytes : Math.round((bytes / scanned) * messagesTotal),
      measuredBytes: bytes,
      messagesTotal,
      scanned,
      estimated: !complete,
    };
  }

  // Google's API exposes no per-product split beyond Drive. Everything the
  // quota counts that Drive does not claim is Gmail plus Photos; once Gmail has
  // been sized, what is left is Photos (plus anything else Google bills there).
  const nonDrive = Math.max(usage - driveUsage, 0);
  const apps = [
    {
      key: 'drive',
      name: 'Google Drive',
      bytes: driveUsage,
      estimated: false,
      detail: drive
        ? `${drive.fileCount} owned files, ${drive.categories.length} types`
        : 'files not listed',
    },
  ];

  if (gmail) {
    const gmailBytes = Math.min(gmail.bytes, nonDrive);
    apps.push({
      key: 'gmail',
      name: 'Gmail',
      bytes: gmailBytes,
      estimated: gmail.estimated,
      detail: gmail.estimated
        ? `extrapolated from ${gmail.scanned} of ${gmail.messagesTotal} messages`
        : `${gmail.messagesTotal} messages, all measured`,
    });
    apps.push({
      key: 'photos',
      name: 'Google Photos and other',
      bytes: Math.max(nonDrive - gmailBytes, 0),
      estimated: true,
      detail: 'quota Google bills outside Drive and Gmail',
    });
  } else {
    apps.push({
      key: 'gmail-photos',
      name: 'Gmail and Google Photos',
      bytes: nonDrive,
      estimated: false,
      detail: 'run the Gmail scan to split these apart',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    account: about.user ?? {},
    quota: {
      limit,
      usage,
      free: limit === null ? null : Math.max(limit - usage, 0),
      usageInDrive: driveUsage,
      usageInDriveTrash: Number(quota.usageInDriveTrash ?? 0),
    },
    apps: apps.sort((a, b) => b.bytes - a.bytes),
    drive,
    gmail,
  };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(2) : value.toFixed(unit ? 1 : 0)} ${UNITS[unit]}`;
}
