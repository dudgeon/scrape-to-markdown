# Privacy Policy — scrape-to-markdown (s2md)

**Last updated:** 2026-02-12

## What this extension does

scrape-to-markdown (s2md) is a Chrome extension that exports Slack conversations as clean markdown. It reads messages from Slack channels you are already authenticated to and converts them into structured markdown text.

## Data collection

This extension does **not** collect, transmit, or store any personal data. Specifically:

- **No analytics or telemetry** — no usage data is sent anywhere.
- **No external services** — the extension communicates only with Slack's own API servers (`slack.com/api/*`), using your existing browser session.
- **No accounts** — the extension does not require sign-up or registration.

## Data usage

### Slack session token

The extension reads your existing Slack session token (`xoxc-`) from the Slack web app page you are already logged into. This token is:

- Stored only in `chrome.storage.session` (ephemeral — automatically cleared when you close the browser)
- Used exclusively to make **read-only** API calls to Slack
- Never sent to any server other than `slack.com`

### Session cookie

The extension reads the Slack session cookie (`d`) via `chrome.cookies` to authenticate API requests. This cookie is:

- Used only for requests to `slack.com/api/*`
- Never stored, logged, or transmitted to any third party

### User name cache

Display names resolved from Slack user IDs are cached in `chrome.storage.local` to reduce API calls. This cache:

- Contains only Slack display names (no email addresses, profile photos, or other PII)
- Is stored locally on your device
- Can be cleared by removing the extension

### Frontmatter templates

User-created frontmatter templates are stored in `chrome.storage.sync` (synced across your Chrome instances). These contain only template configuration — no personal or conversation data.

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `activeTab` | Run the content script on the active Slack tab to detect the current channel |
| `cookies` | Read the Slack session cookie for API authentication |
| `storage` | Store the session token (ephemeral), user name cache (local), and templates (sync) |
| `clipboardWrite` | Copy exported markdown to your clipboard |
| `host_permissions: app.slack.com` | Inject the content script and read the session cookie |
| `host_permissions: slack.com/api` | Make read-only API calls to export conversations |

## Data sharing

This extension shares data with **no one**. All data stays between your browser and Slack's servers.

## Contact

For questions or concerns about this privacy policy, open an issue at:
https://github.com/dudgeon/scrape-to-markdown/issues
