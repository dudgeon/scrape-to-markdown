# scrape-to-markdown (s2md)

A Chrome extension that scrapes web content and converts it to clean markdown. Two modes: **Slack conversation export** (full message history via API, with threads, reactions, and frontmatter) and **web page clipping** (any page via Readability.js + Turndown.js). The popup auto-detects which mode to use based on the active tab.

<p align="center">
  <img src="docs/images/s2md-flow.png" alt="s2md flow: Slack conversations and web content → s2md extension → clean markdown → your AI of choice" width="700">
</p>

## Installation

This extension is distributed as an **unpacked Chrome extension** (Chrome Web Store submission pending review).

### Prerequisites

- Google Chrome (or any Chromium-based browser: Edge, Brave, Arc, etc.)

### Steps

1. **Download the extension**
   - Clone this repo or download it as a ZIP
   - The built extension is in the `dist/` folder, ready to load
   - If building from source: install [Node.js >= 20](https://nodejs.org/), then run `npm install && npm run build`

2. **Load in Chrome**
   - Navigate to `chrome://extensions/`
   - Toggle **Developer mode** ON (top-right)
   - Click **"Load unpacked"** (top-left)
   - Select the `dist/` folder (the one containing `manifest.json`)

3. **Pin the extension** (recommended)
   - Click the puzzle-piece icon in the Chrome toolbar
   - Find "scrape-to-markdown (s2md)" and click the pin icon

4. **Use it**
   - **Slack**: Navigate to any Slack channel at `app.slack.com`, click the icon — it detects the channel automatically. Choose scope and options, then copy or download.
   - **Web clipping**: Navigate to any web page, click the icon — it extracts the article content and converts to markdown. Select text first to clip just the selection.

### Updating

1. Pull or download the latest version
2. If building from source: `npm run build`
3. Go to `chrome://extensions/` and click the refresh icon on the extension card

### Alternative: Tampermonkey Userscript

Can't load unpacked extensions? s2md also runs as a **Tampermonkey userscript** with the same features and identical markdown output. See the [Tampermonkey install guide](docs/tampermonkey-install.md) for setup instructions.

## Features

### Web Page Clipping

- Click the extension icon on any non-Slack page to clip the article as markdown
- Uses [Readability.js](https://github.com/mozilla/readability) for article extraction and [Turndown.js](https://github.com/mixmark-io/turndown) for HTML-to-markdown conversion
- GFM support: tables and strikethrough via the Turndown GFM plugin
- Custom rules for `<figure>` elements (preserves captions), `<video>`, and `<iframe>` embeds
- **Selection clipping**: select text before clicking to clip just the selection
- Optional YAML frontmatter (title, author, source URL, capture date)
- Falls back to full `<body>` conversion if Readability can't extract the article

### Slack Capture Modes

| Mode | Description |
|------|-------------|
| **Last N messages** | Export the most recent 25–500 messages from the current channel |
| **Date range** | Export all messages between two dates |
| **All messages** | Export entire channel history (paginated, with progress indicator) |

### Thread Handling

- Optionally expand threaded conversations inline beneath the parent message
- Threads are rendered as a grouped blockquote with a header showing reply count and a preview of the parent message for disambiguation
- Each reply includes its own author and timestamp
- Designed for LLM readability — parent→reply lineage is explicit and unambiguous

### Output Options

- **Reactions** — emoji reaction counts on messages (`:thumbsup: 3 · :heart: 1`)
- **File references** — attached file names with links
- **YAML frontmatter** — optional structured metadata block (source, workspace, channel type, dates, message count, tags)
- **Copy to clipboard** — one-click copy of the full markdown
- **Download as .md** — saves a file named `#channel-YYYY-MM-DD.md`

### Frontmatter Templates

- Customizable `{{variable|filter}}` template engine for YAML frontmatter fields
- Built-in templates: Slack Default, Slack Detailed, and Web Clip Default
- Settings page (gear icon) to create, edit, and manage custom templates
- Live preview of rendered YAML while editing
- 8 filters: `date`, `lowercase`, `uppercase`, `default`, `join`, `slug`, `trim`, `truncate`

### Markdown Conversion

- Full `rich_text` block conversion (bold, italic, strikethrough, code, links, emoji, @mentions, #channels)
- Fallback to Slack's legacy `mrkdwn` format for older/bot messages
- Messages grouped by date with `## YYYY-MM-DD` headers
- System messages (joins, topic changes) rendered as italicized text

## How It Works

The popup detects the active tab and switches modes automatically:

- **Slack tabs** (`app.slack.com`): The extension passively captures your existing Slack session token (`xoxc-`) from Slack's own HTTP requests (via `chrome.webRequest`) and uses it to call Slack's `conversations.history` API directly. This bypasses Slack's virtual scrolling limitation (which only keeps ~50 messages in the DOM) and returns structured rich text data that converts cleanly to markdown.
- **All other tabs**: The extension injects a content script that clones the page DOM, extracts the article via Readability.js, and converts it to markdown via Turndown.js. All processing happens locally in the browser.

## Privacy & Security

- Tokens are stored only in `chrome.storage.session` (cleared when the browser closes)
- The extension makes **read-only** API calls only
- No data is sent anywhere except to Slack's own API
- No analytics, no telemetry, no external services

## Development

Requires Node >= 20 (see `.nvmrc`).

```bash
npm install          # install dependencies
npm run dev          # vite dev server with HMR
npm run build        # typecheck + production build to dist/
npm test             # run vitest tests
npm run test:watch   # tests in watch mode
npm run typecheck    # typescript check only
```

## Known Limitations

- **Enterprise Grid**: only exports the currently-viewed workspace (no org-level token support)
- **Rate limits**: large channels (10K+ messages) will take time due to 1-second delays between API pages
- **Refresh required after install**: Chrome doesn't inject content scripts into already-open tabs when an extension is loaded. Refresh the Slack tab after installing or updating.
- **Web clip extraction**: some pages with heavy JavaScript rendering or paywalls may not extract cleanly. The extension falls back to converting the full page body when Readability can't identify the article.

## Version

v0.1.0 — see [CHANGELOG.md](CHANGELOG.md) for details.
