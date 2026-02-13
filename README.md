# scrape-to-markdown (s2md)

A Chrome extension that scrapes web content — starting with Slack conversations — and converts it to clean markdown. Uses Slack's internal API to capture full message history including threads, reactions, and file references. Future phases add general web page clipping via Readability.js + Turndown.js.

<p align="center">
  <img src="docs/images/s2md-flow.png" alt="s2md flow: Slack conversations and web content → s2md extension → clean markdown → your AI of choice" width="700">
</p>

## Installation

This extension is distributed as an **unpacked Chrome extension** (not on the Chrome Web Store).

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
   - Find "Slack Conversation Copier" and click the pin icon

4. **Use it**
   - Navigate to any Slack channel at `app.slack.com`
   - Click the extension icon — it detects the channel automatically
   - Choose your scope and options, then copy or download

### Updating

1. Pull or download the latest version
2. If building from source: `npm run build`
3. Go to `chrome://extensions/` and click the refresh icon on the extension card

### Alternative: Tampermonkey Userscript

Can't load unpacked extensions? s2md also runs as a **Tampermonkey userscript** with the same features and identical markdown output. See the [Tampermonkey install guide](docs/tampermonkey-install.md) for setup instructions.

## Features

### Capture Modes

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
- Built-in templates: Slack Default and Slack Detailed
- Settings page (gear icon) to create, edit, and manage custom templates
- Live preview of rendered YAML while editing
- 8 filters: `date`, `lowercase`, `uppercase`, `default`, `join`, `slug`, `trim`, `truncate`

### Markdown Conversion

- Full `rich_text` block conversion (bold, italic, strikethrough, code, links, emoji, @mentions, #channels)
- Fallback to Slack's legacy `mrkdwn` format for older/bot messages
- Messages grouped by date with `## YYYY-MM-DD` headers
- System messages (joins, topic changes) rendered as italicized text

## How It Works

The extension extracts your existing Slack session token (`xoxc-`) from the page and uses it to call Slack's `conversations.history` API directly. This bypasses Slack's virtual scrolling limitation (which only keeps ~50 messages in the DOM) and returns structured rich text data that converts cleanly to markdown.

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
- **Token extraction**: depends on `window.boot_data.api_token` being available — if Slack changes this, the extension will need updating
- **DOM fallback**: not yet implemented (planned for a future release)

## Version

v0.1.0 — see [CHANGELOG.md](CHANGELOG.md) for details.
