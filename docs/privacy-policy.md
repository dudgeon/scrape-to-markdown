# Privacy Policy — scrape-to-markdown (s2md)

**Last updated:** 2026-02-13

## What this extension does

scrape-to-markdown (s2md) is a Chrome extension that converts web content to clean markdown. It has two modes:

- **Web page clipping** — extracts the article content from any web page and converts it to markdown, entirely within your browser.
- **Slack conversation export** — reads messages from Slack channels you are already authenticated to and converts them into structured markdown text.

The popup auto-detects which mode to use based on the active tab.

## Data collection

This extension does **not** collect, transmit, or store any personal data. Specifically:

- **No analytics or telemetry** — no usage data is sent anywhere.
- **No external services** — the extension communicates only with Slack's own API servers (`slack.com/api/*`) for Slack exports. Web clipping is processed entirely locally.
- **No accounts** — the extension does not require sign-up or registration.
- **No remote code** — all processing happens locally in your browser using bundled libraries.

## Data usage

### Web page clipping

When you click the extension icon on a non-Slack page, the extension:

1. Reads the current page's HTML from the active tab
2. Extracts the article content using Readability.js (locally, in the browser)
3. Converts it to markdown using Turndown.js (locally, in the browser)
4. Presents the result for you to copy or download

No page content is sent to any server. All processing happens locally in the extension popup.

### Slack session token

The extension passively captures your existing Slack session token (`xoxc-`) from Slack's own HTTP requests using `chrome.webRequest` listeners. This token is:

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
| `activeTab` | Read the active tab's URL to detect Slack vs. non-Slack pages, and inject the web clipping script into the active tab to extract page content. Also grants temporary access for context menu and keyboard shortcut clipping. |
| `contextMenus` | Register right-click menu items ("Copy page as Markdown", "Copy selection as Markdown") for quick clipping without opening the popup |
| `offscreen` | Create an offscreen document to run DOM-dependent article extraction (Readability.js) when clipping via context menu or keyboard shortcut — the service worker has no DOM access |
| `scripting` | Inject a content script into the active tab on demand to read page HTML for web clipping (used with `chrome.scripting.executeScript`) |
| `clipboardWrite` | Copy exported markdown to your clipboard |
| `cookies` | Read the Slack session cookie (`d`) for API authentication |
| `storage` | Store the session token (ephemeral), user name cache (local), and frontmatter templates (sync) |
| `webRequest` | Passively observe Slack's HTTP traffic to capture the session token from request headers — no requests are modified or blocked |
| `host_permissions: app.slack.com` | Inject the Slack content script (channel detection) and read the session cookie |
| `host_permissions: slack.com/api` | Make read-only API calls to export Slack conversations |
| `host_permissions: edgeapi.slack.com` | Some Slack API traffic routes through this subdomain |

## Data sharing

This extension shares data with **no one**. All data stays between your browser and Slack's servers. Web clipping data never leaves your browser.

## Contact

For questions or concerns about this privacy policy, open an issue at:
https://github.com/dudgeon/scrape-to-markdown/issues
