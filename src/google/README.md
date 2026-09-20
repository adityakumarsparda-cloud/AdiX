# Google storage by app

One small app that answers "which Google app is eating my 15 GB?" — a browser
dashboard plus a terminal report, both read-only, both zero-dependency.

```bash
npm run google                 # dashboard on http://localhost:3100
npm run google:report          # same numbers in the terminal
npm run google:report -- --gmail --json
```

## What Google will and will not tell you

There is no API that returns "Photos: 4 GB, Gmail: 3 GB". The only per-product
number Google publishes is Drive's. So the breakdown is assembled:

| App | Where the number comes from | Exact? |
|---|---|---|
| Google Drive | `drive/v3/about` → `storageQuota.usageInDrive` | yes |
| Gmail | sum of every message's `sizeEstimate` | yes if the whole mailbox is scanned, otherwise extrapolated |
| Google Photos and other | total usage − Drive − Gmail | no — it is the remainder |

Anything estimated is labelled as such in both the dashboard and the JSON, so a
scaled-up figure is never shown as if it had been measured.

Drive is then broken down further from the file listing — Docs, Sheets, PDFs,
videos, images, archives — using `quotaBytesUsed`, the bytes each file actually
charges to the quota. Only files you own are counted, because a file shared with
you is billed to its owner. Google's own editor formats (Docs, Sheets, Slides)
report 0 bytes; they are listed anyway, since "Docs costs nothing" is part of the
answer. Binned files still count against the quota until the bin is emptied, so
they are counted and called out separately.

## Why the Gmail scan is slow

Gmail has no mailbox-size endpoint. Size means one `messages.get` per message,
so a 60,000-message mailbox is 60,000 requests. `GOOGLE_GMAIL_SCAN_LIMIT`
(default 2,000) caps it; past that the total is scaled from the messages that
were scanned and flagged as an estimate. Requests run 20 at a time and back off
when Google throttles.

## Setup

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials),
   create a project and enable the **Drive API** and the **Gmail API**.
2. Configure the OAuth consent screen (External, testing is fine) and add your
   own address as a test user.
3. Create an **OAuth client ID** of type *Web application* with
   `http://localhost:3100/callback` under *Authorized redirect URIs*.
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env`.
5. `npm run google`, then **Connect Google** once. The token is written to
   `.google-tokens.json` (git-ignored) and refreshed automatically after that.

## Scopes

| Scope | Why |
|---|---|
| `drive.metadata.readonly` | file names, types and sizes — never file contents |
| `gmail.metadata` | message sizes and headers — never message bodies |
| `openid`, `email` | show which account is connected |

All read-only. The app writes nothing to your account and sends nothing anywhere
but Google.

## Routes and files

| Path | What it is |
|---|---|
| `/` | dashboard: bar, per-app table, Drive breakdown, largest files |
| `/auth`, `/callback` | OAuth 2.0 authorization code flow, with `state` CSRF check |
| `/api/usage?gmail=1&drive=1` | the whole report as JSON |
| `config.js` | env and scopes |
| `oauth.js` | authorize URL, code exchange, refresh, token store |
| `api.js` | Drive and Gmail calls, paging, pooling, backoff |
| `usage.js` | classification and the report — the pure part |
| `ui.js` | the dashboard page |
| `report.js` | terminal version |
