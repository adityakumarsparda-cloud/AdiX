# AdiX — LinkedIn OAuth

A minimal, zero-dependency reference implementation of LinkedIn's 3-legged OAuth 2.0
flow, plus the two API calls the self-serve products allow.

## What LinkedIn's API actually permits

Self-serve products (auto-approved on the app's **Products** tab):

| Product | Scopes | What you can do |
|---|---|---|
| Sign In with LinkedIn using OpenID Connect | `openid` `profile` `email` | Read your own name, email, photo, member id |
| Share on LinkedIn | `w_member_social` | Publish posts to your own feed |

**Not available** without an approved LinkedIn partnership: your connections list,
messages/InMail, the feed, other members' data, job postings, recruiter data.
To get your own connections or message history, use LinkedIn's data export instead
(Settings → Data Privacy → Get a copy of your data).

## Setup

1. Create an app at <https://www.linkedin.com/developers/apps>. It must be attached
   to a LinkedIn Page, and you must click **Verify** on the Settings tab.
2. On the **Products** tab, add both products listed above.
3. On the **Auth** tab, add `http://localhost:3000/callback` under
   *Authorized redirect URLs*. This must match `LINKEDIN_REDIRECT_URI` exactly —
   a trailing-slash mismatch is rejected.
4. Copy credentials into a local env file:

   ```bash
   cp .env.example .env
   # then fill in LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET
   ```

5. Run it:

   ```bash
   npm start
   # open http://localhost:3000
   ```

## The flow

```
  /auth  ──302──▶  linkedin.com/oauth/v2/authorization      you click "Allow"
                              │
  /callback  ◀──302 with ?code=…&state=…──┘
      │
      ├─ verify state matches one we issued          (CSRF check)
      ├─ POST /oauth/v2/accessToken  {code, id, secret}   ← server-to-server
      └─ store access_token in .tokens.json
```

The `code` is single-use and expires in about 30 seconds. The client secret is only
ever sent in step 4, from the server — it never reaches the browser.

## Routes

| Route | Purpose |
|---|---|
| `/` | Connection status |
| `/auth` | Start the flow — redirects to LinkedIn |
| `/callback` | Receives the code, exchanges it, saves the token |
| `/me` | `GET /v2/userinfo` with the stored token |
| `/post?text=Hello` | Publish a text post (demo; a real app would use POST + CSRF token) |

## Token lifetime

Access tokens last 60 days (`expires_in: 5184000`). **Refresh tokens are only issued
to approved partner apps** — with self-serve products you re-run `/auth` when the
token expires.

## Secrets

`.env` and `.tokens.json` are git-ignored. Never commit either. If a secret is ever
exposed, rotate it immediately from the app's Auth tab — the old one stops working
as soon as you generate a new one.

## API version header

Calls to `api.linkedin.com/rest/*` require a `LinkedIn-Version: YYYYMM` header, and
LinkedIn retires versions after roughly a year. Rather than hardcode one that
quietly expires, the client starts at the current month and walks backwards until
the server accepts a version, so this keeps working as versions roll over.

Set `LINKEDIN_API_VERSION` in `.env` to pin a specific version and skip the search.
