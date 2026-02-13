# Slack Conversation Copier — Chrome Extension Spec

## Problem

Copying messages from Slack into markdown is painful. Slack's native copy-paste strips formatting, mangles links, loses timestamps, and produces messy plaintext. For anyone who archives conversations, writes meeting notes, or feeds context to LLMs, this is a recurring friction point.

The core technical challenge: Slack's web client uses **virtual scrolling** — only ~50 messages exist in the DOM at any time. Scrolling up loads older messages and removes newer ones from the DOM. You can't just `querySelectorAll` and grab everything.

## Approach: Hybrid (API-first, DOM-fallback)

Research surfaced three strategies, each with tradeoffs:

| Strategy | Pros | Cons |
|---|---|---|
| **DOM scraping** | No auth setup, works immediately | Virtual scroll means incomplete capture; brittle selectors; formatting lossy |
| **XHR/fetch interception** | Captures structured JSON as Slack loads it | Only gets messages the user scrolls past; complex to orchestrate |
| **Internal API calls** (using session token) | Complete data, structured rich_text blocks, supports pagination and date filtering natively | Requires extracting `xoxc` token; uses undocumented internal API |

**Recommendation: Use the internal API approach.** The Slack web client authenticates with a `xoxc-` session token (visible in `boot_data` or network requests). A Chrome extension can extract this token and call `conversations.history` directly, getting clean structured JSON with full formatting data. This is the same approach the Slack web client itself uses, and the same approach recommended by the (now-archived) `slack-web-scraper` project author after years of DOM scraping pain.

The DOM approach is retained as a lightweight fallback for "copy what's visible" scenarios.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)             │
│                                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │ Content   │  │ Service   │  │ Popup /  │  │
│  │ Script    │  │ Worker    │  │ Side     │  │
│  │           │  │           │  │ Panel    │  │
│  │ • Token   │  │ • API     │  │ • UI     │  │
│  │   extract │  │   calls   │  │ • Config │  │
│  │ • DOM     │  │ • mrkdwn  │  │ • Preview│  │
│  │   fallback│  │   → md    │  │ • Copy   │  │
│  │ • Channel │  │ • Paginat.│  │          │  │
│  │   ID      │  │ • Cache   │  │          │  │
│  └──────────┘  └───────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

### Content Script (`content.js`)

Runs on `app.slack.com`. Responsibilities:

1. **Extract session token** — Read `xoxc-` token from one of:
   - `window.boot_data.api_token` (injected via page script)
   - Intercepting a `client.boot` or `conversations.history` XHR and reading the `token` parameter from the request body
   - As a last resort, prompting the user to paste it from DevTools

2. **Extract current channel ID** — Parse from the URL (`/client/{workspace}/{channelId}`) or from `boot_data`.

3. **Extract the `d` cookie** — The `xoxc` token requires the `d` cookie for authentication. Chrome extensions can access HttpOnly cookies via `chrome.cookies.get()` with appropriate permissions.

4. **DOM fallback** — For "copy visible messages" mode, scrape currently-rendered messages from the DOM (see DOM Scraping section below).

5. **Inject UI trigger** — Add a floating button or integrate into Slack's toolbar area.

### Service Worker (`background.js`)

Handles API calls (content scripts can't make cross-origin requests to `slack.com/api/*` without the service worker relaying them).

1. **Call `conversations.history`** — Paginate through messages using cursor-based pagination. Supports `oldest` and `latest` Unix timestamp parameters for date filtering.

2. **Call `conversations.replies`** — For threaded messages, fetch full thread contents.

3. **Call `users.info`** — Resolve user IDs (`U12345`) to display names. Cache aggressively.

4. **Call `conversations.info`** — Get channel name for the export header.

5. **Convert rich_text blocks → Markdown** — The core transformation engine (see Conversion section).

### Popup / Side Panel (`popup.html`)

The user-facing control surface:

- **Scope selector**: "All messages", "Last N messages", "Date range" (from/to date pickers)
- **Thread handling**: toggle to include/exclude thread replies inline
- **Preview pane**: show the first few converted messages before committing
- **Copy button**: copies final markdown to clipboard
- **Download button**: saves as `.md` file
- **Status/progress**: show pagination progress for large channels

---

## Token & Auth Flow

> **Note (2026-02):** The original `boot_data` and fetch-interception strategies below are obsolete. Slack client-v2 no longer exposes `window.boot_data`, and Slack's CSP blocks blob URLs. The implementation now uses passive `chrome.webRequest` listeners in the service worker to capture the `xoxc-` token from Slack's own HTTP traffic (Authorization header and POST body). See `src/background/index.ts`.

```
User opens Slack in Chrome
  → Service worker's chrome.webRequest listeners observe Slack API traffic
  → Token captured from Authorization header or POST body token= field
  → Stored in chrome.storage.session

For the d cookie:
  → Service worker calls chrome.cookies.get({url: "https://app.slack.com", name: "d"})
  → Requires "cookies" permission in manifest
```

**Token lifecycle**: `xoxc` tokens remain valid as long as the browser session is active (typically weeks). The extension should detect 401/invalid_auth responses and re-extract.

**Security considerations**: Tokens are stored only in `chrome.storage.session` (cleared when browser closes). Never synced, never logged. The extension makes read-only API calls only.

---

## Slack API Usage

### conversations.history

```
POST https://slack.com/api/conversations.history
Headers:
  Authorization: Bearer xoxc-...
  Cookie: d=xoxd-...
  Content-Type: application/x-www-form-urlencoded

Body:
  channel=C12345
  limit=200          // max per page (API max is 999, recommended ≤200)
  oldest=1700000000  // Unix timestamp, for date range filtering
  latest=1710000000  // Unix timestamp, for date range filtering
  inclusive=true
```

Response includes `messages[]` array, each containing:
- `ts` — Unix timestamp (also serves as message ID)
- `user` — User ID (e.g., `U12345`)
- `text` — Legacy mrkdwn text (fallback)
- `blocks[]` — Rich text blocks (preferred for conversion)
- `thread_ts` — If present, message is a thread parent or reply
- `reply_count` — Number of thread replies (on parent messages)
- `reactions[]` — Emoji reactions
- `files[]` — Attached files
- `attachments[]` — Legacy attachments / link unfurls

Pagination: Response includes `response_metadata.next_cursor`. Keep calling with `cursor` parameter until no more pages.

### conversations.replies

For threads:
```
POST https://slack.com/api/conversations.replies
Body:
  channel=C12345
  ts=1234567890.123456   // thread parent ts
  limit=200
```

### users.info (for display name resolution)

```
POST https://slack.com/api/users.info
Body:
  user=U12345
```

Cache the `user.real_name` or `user.profile.display_name` in `chrome.storage.local` to avoid repeated lookups.

---

## Rich Text → Markdown Conversion

This is the heart of the extension. Slack messages use `rich_text` blocks with a structured element tree. The converter must walk this tree and produce clean markdown.

### rich_text Block Structure

```json
{
  "type": "rich_text",
  "elements": [
    {
      "type": "rich_text_section",      // paragraph
      "elements": [
        {"type": "text", "text": "Hello ", "style": {"bold": true}},
        {"type": "user", "user_id": "U12345"},
        {"type": "link", "url": "https://...", "text": "click here"},
        {"type": "emoji", "name": "wave"}
      ]
    },
    {
      "type": "rich_text_list",          // bullet or ordered list
      "style": "bullet",
      "indent": 0,
      "elements": [
        {"type": "rich_text_section", "elements": [...]}
      ]
    },
    {
      "type": "rich_text_preformatted",  // code block
      "elements": [
        {"type": "text", "text": "const x = 1;"}
      ]
    },
    {
      "type": "rich_text_quote",         // blockquote
      "elements": [
        {"type": "text", "text": "Someone said this"}
      ]
    }
  ]
}
```

### Conversion Rules

| Slack Element | Markdown Output |
|---|---|
| `text` with `style.bold` | `**text**` |
| `text` with `style.italic` | `*text*` |
| `text` with `style.strike` | `~~text~~` |
| `text` with `style.code` | `` `text` `` |
| Combined styles (bold+italic) | `***text***` |
| `link` with `text` | `[text](url)` |
| `link` without `text` | `<url>` (autolink) |
| `emoji` | `:name:` (preserve colon notation) |
| `user` | `@DisplayName` (resolved via API) |
| `channel` | `#channel-name` (resolved via API) |
| `usergroup` | `@group-name` |
| `rich_text_section` | Concatenated inline content + `\n\n` |
| `rich_text_list` (bullet) | `- item` with indentation via spaces |
| `rich_text_list` (ordered) | `1. item` with indentation |
| `rich_text_list` with `indent: N` | `  ` × N prefix (2 spaces per level) |
| `rich_text_preformatted` | ```` ```\ncontent\n``` ```` |
| `rich_text_quote` | `> content` |

### Fallback: mrkdwn text field

If `blocks` is absent (older messages, bot messages), fall back to the `text` field and convert Slack's mrkdwn:

| Slack mrkdwn | Markdown |
|---|---|
| `*bold*` | `**bold**` |
| `_italic_` | `*italic*` |
| `~strike~` | `~~strike~~` |
| `` `code` `` | `` `code` `` (same) |
| ```` ```code block``` ```` | ```` ```\ncode block\n``` ```` |
| `> quote` | `> quote` (same) |
| `<URL\|text>` | `[text](URL)` |
| `<URL>` | `<URL>` |
| `<@U12345>` | `@DisplayName` |
| `<#C12345\|channel>` | `#channel` |

---

## Output Format

The final markdown document follows this structure:

```markdown
# #channel-name

Exported from Slack · 2025-02-11 · Messages: 142

---

## 2025-02-10

**Alice Johnson** — 9:15 AM

Here's the **updated proposal** with the changes we discussed.
Check out the [design doc](https://docs.google.com/...) when you get a chance.

> **Bob Smith** — 9:22 AM (thread reply)
>
> Looks great! One question about the timeline on page 3.

**Charlie Davis** — 10:03 AM

Quick update: the deploy went through :rocket:
- Staging is green
- Prod rollout at 2pm
- @Alice Johnson please monitor the dashboard

---

## 2025-02-11

**Alice Johnson** — 8:30 AM

Morning! :wave: Let's sync at 10.

```

### Formatting Decisions

- **Date headers**: Group messages by date with `## YYYY-MM-DD` headers
- **Author + timestamp**: `**Display Name** — HH:MM AM/PM` on its own line
- **Thread replies**: Indented as blockquotes beneath the parent message, with their own author/timestamp
- **Reactions**: Appended as a line: `> :thumbsup: 3 · :heart: 1`
- **Files/attachments**: `📎 [filename.pdf](url)` or `📎 filename.pdf (no public URL)`
- **Bot messages**: Same format, using bot name as author
- **System messages** (joins, topic changes): Italicized: `*Alice joined the channel*`
- **Links**: Preserved as markdown links. Unfurled preview text is omitted (just the link)
- **Emoji**: Kept as `:shortcode:` by default, with an option to convert to Unicode

---

## DOM Fallback Mode

For a lightweight "copy what's visible" without API calls:

### Slack's Current DOM Structure (as of early 2025)

Slack uses a React-based virtual list. Key selectors (subject to change):

```
.c-virtual_list__scroll_container     // scrollable message container
  [data-qa="virtual-list-item"]       // individual message wrapper
    .c-message_kit__message           // message content area
      .c-message_kit__sender          // author name
      .c-timestamp                    // timestamp element (data-ts attr)
      .p-rich_text_section            // rich text paragraph
      .p-rich_text_block              // top-level rich text block
        b, i, s, code, pre            // inline formatting
        a[href]                       // links
        [data-stringify-type="emoji"] // emoji elements
```

### DOM Scraping Logic

```javascript
function scrapeVisibleMessages() {
  const messages = document.querySelectorAll('[data-qa="virtual-list-item"]');
  return Array.from(messages).map(el => {
    const sender = el.querySelector('.c-message_kit__sender')?.textContent;
    const timestamp = el.querySelector('.c-timestamp')?.getAttribute('data-ts');
    const richText = el.querySelector('.p-rich_text_block');
    
    // Walk the rich text DOM and convert to markdown
    const markdown = richText ? domToMarkdown(richText) : '';
    
    return { sender, timestamp, markdown };
  });
}
```

**Limitations of DOM mode:**
- Only captures messages currently rendered in the viewport (~30-50 messages)
- Must scroll to load more (no auto-scroll; user-driven)
- Timestamp precision varies (relative times like "2 hours ago" require conversion)
- Thread replies in the side panel have a separate DOM container
- Slack's class names and data attributes change without notice

---

## Scoping / Filtering

| Mode | Implementation |
|---|---|
| **Last N messages** | Set `limit=N` in `conversations.history` (for N ≤ 999). For N > 999, paginate and count. |
| **Date range** | Use `oldest` and `latest` parameters (Unix timestamps). The popup date pickers convert to UTC Unix timestamps. |
| **All messages** | Paginate from the beginning (no `oldest`/`latest`). Show progress bar. |
| **Visible only** (DOM fallback) | Scrape what's currently in the DOM. No API needed. |
| **Thread scope** | When the user has a thread open, detect `thread_ts` from the URL or DOM and call `conversations.replies` instead of `conversations.history`. |

---

## Extension Manifest

```json
{
  "manifest_version": 3,
  "name": "Slack Conversation Copier",
  "version": "0.1.0",
  "description": "Copy Slack conversations as clean markdown",
  "permissions": [
    "activeTab",
    "clipboardWrite",
    "storage",
    "cookies"
  ],
  "host_permissions": [
    "https://app.slack.com/*",
    "https://*.slack.com/*",
    "https://slack.com/api/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://app.slack.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icons/icon48.png"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## Key Technical Risks & Mitigations

### 1. Token extraction breaks

**Risk**: Slack changes how the token is transmitted in HTTP requests.

**Mitigation**: The `chrome.webRequest` approach captures the token from any Slack API request (Authorization header or POST body). This is resilient to page-world JS changes since it operates at the browser network layer. As long as Slack sends `xoxc-` tokens in its own API traffic, the extension will capture them.

### 2. API rate limiting

**Risk**: `conversations.history` is Tier 3 rate-limited (~50 req/min for established apps; 1 req/min for new non-marketplace apps as of May 2025). Since we're using session tokens (not a registered app), the rate limits applied may differ.

**Mitigation**: Add 1-second delays between paginated requests. For very large channels, show progress and allow pause/resume. Most exports will need <10 API calls.

### 3. DOM selectors change

**Risk**: Slack ships new UI, breaking DOM fallback selectors.

**Mitigation**: DOM mode is the fallback, not primary. Use data attributes (`data-qa`, `data-ts`) which are more stable than class names. The extension should degrade gracefully — if selectors fail, show "DOM scraping unavailable, using API mode."

### 4. Session token scope

**Risk**: The `xoxc` token has the same permissions as the logged-in user. It cannot access channels the user hasn't joined.

**Mitigation**: This is actually fine — the extension should only export conversations the user can see. Handle `channel_not_found` or `not_in_channel` errors gracefully.

### 5. Large channel performance

**Risk**: A channel with 50K+ messages could take minutes to export and produce a very large markdown file.

**Mitigation**: Default to "Last 100 messages." Show estimated export size and time for large ranges. Stream results to the preview pane as they arrive. Consider chunking output into multiple files for exports > 1000 messages.

---

## Implementation Phases

### Phase 1: MVP (API-first, basic UI)

- Token extraction (boot_data method)
- `conversations.history` with pagination
- Rich text → markdown conversion (core elements)
- User ID → display name resolution with caching
- Simple popup: channel auto-detected, "Last N messages" selector, copy button
- Date grouping in output

### Phase 2: Full Scoping + Threads

- Date range picker
- Thread reply expansion (`conversations.replies`)
- Thread display options (inline vs. collapsed)
- Reactions in output
- File/attachment references
- Download as `.md` file
- Progress indicator for large exports

### Phase 3: Polish + Resilience

- DOM fallback mode ("copy visible")
- Side panel UI (richer than popup)
- Multiple token extraction strategies
- Error handling and retry logic
- Export to clipboard in other formats (HTML, JSON)
- Configurable output format (template system)
- Keyboard shortcut trigger

---

## Open Questions

1. **Thread display format**: Should thread replies be nested blockquotes (compact) or full-width with an indent marker? Need to test readability with real conversations.

2. **Emoji rendering**: Default to `:shortcode:` or Unicode? Shortcodes are more portable but less readable. Could offer a toggle.

3. **Bot messages and integrations**: Some bot messages (Jira, GitHub, etc.) use `attachments[]` with custom layouts. How far should we go in converting these? Phase 1 could just render them as `[Bot: app_name] text_fallback`.

4. **DM support**: The same API works for DMs (channel IDs starting with `D`). Should the UI surface this differently?

5. **Enterprise Grid**: Users on Enterprise Grid have org-level tokens. Should we support workspace switching or just export the currently-viewed workspace?
