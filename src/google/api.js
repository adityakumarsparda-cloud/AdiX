const DRIVE_ABOUT = 'https://www.googleapis.com/drive/v3/about';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a Google API endpoint. Google throttles per-user with 403/429, and the
 * documented remedy is exponential backoff rather than failing the whole scan.
 */
async function apiGet(url, accessToken, params = {}, attempt = 0) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) target.searchParams.set(key, String(value));
  }

  const res = await fetch(target, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.ok) return res.json();

  const text = await res.text();
  const retriable = res.status === 429 || res.status >= 500 ||
    (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(text));

  if (retriable && attempt < 5) {
    await sleep(2 ** attempt * 250 + Math.random() * 250);
    return apiGet(url, accessToken, params, attempt + 1);
  }
  throw new Error(`${target.pathname} failed (${res.status}): ${text.slice(0, 500)}`);
}

/** Account-wide quota: the totals Google itself shows on the storage page. */
export function fetchAbout(accessToken) {
  return apiGet(DRIVE_ABOUT, accessToken, {
    fields: 'user(displayName,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)',
  });
}

/**
 * Every file this account owns, with the bytes it actually charges to the
 * quota. Only owned files count — a file shared with you is billed to its
 * owner — so the listing is filtered to 'me' in owners.
 */
export async function fetchOwnedFiles(accessToken, { onProgress } = {}) {
  const files = [];
  let pageToken;

  do {
    const page = await apiGet(DRIVE_FILES, accessToken, {
      q: "'me' in owners",
      pageSize: 1000,
      fields: 'nextPageToken,files(id,name,mimeType,size,quotaBytesUsed,trashed,modifiedTime)',
      spaces: 'drive',
      includeItemsFromAllDrives: false,
      pageToken,
    });
    files.push(...(page.files ?? []));
    onProgress?.(files.length);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return files;
}

export function fetchGmailProfile(accessToken) {
  return apiGet(`${GMAIL}/profile`, accessToken);
}

/** Runs `worker` over `items` with a bounded number of requests in flight. */
async function pooled(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      await worker(items[cursor++]);
    }
  });
  await Promise.all(runners);
}

/**
 * Gmail exposes no mailbox-size field, so size is the sum of every message's
 * sizeEstimate. That is one request per message, which is why the scan is
 * capped: past `limit` messages the caller extrapolates from what was scanned.
 */
export async function scanGmailSize(accessToken, { limit, onProgress } = {}) {
  const ids = [];
  let pageToken;

  do {
    const page = await apiGet(`${GMAIL}/messages`, accessToken, {
      maxResults: 500,
      includeSpamTrash: true,
      fields: 'nextPageToken,messages/id',
      pageToken,
    });
    for (const m of page.messages ?? []) {
      if (ids.length >= limit) break;
      ids.push(m.id);
    }
    pageToken = ids.length >= limit ? undefined : page.nextPageToken;
  } while (pageToken);

  let bytes = 0;
  let scanned = 0;
  await pooled(ids, 20, async (id) => {
    const message = await apiGet(`${GMAIL}/messages/${id}`, accessToken, {
      format: 'metadata',
      metadataHeaders: 'From',
      fields: 'sizeEstimate',
    });
    bytes += Number(message.sizeEstimate ?? 0);
    scanned += 1;
    if (scanned % 100 === 0) onProgress?.(scanned, ids.length);
  });

  return { bytes, scanned };
}
