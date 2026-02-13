# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.2.0] — 2026-02-13

### Added

- **Context menu** — right-click any page to "Copy page as Markdown" or "Copy selection as Markdown" without opening the popup
- **Keyboard shortcuts** — `Alt+Shift+M` opens the popup, `Alt+Shift+C` clips the current page to clipboard
- **Error handling and retry** — Slack API calls now retry with exponential backoff on transient errors (rate limits, network failures). Popup shows a "Retry" button for transient errors and a clear message for expired sessions.
- **Participant list** — DM and group DM exports now include a `participants` field in frontmatter (via `conversations.members` API, resolved to display names). Available in the Slack Detailed template.
- **Offscreen document** — DOM-dependent processing (Readability + Turndown) runs in a Chrome offscreen document, enabling context menu and keyboard shortcut clipping from the service worker
- **Web clipping** — clip any web page as clean markdown (Readability.js + Turndown.js)
  - Popup auto-detects Slack vs. non-Slack tabs and switches UI mode
  - Article extraction with Readability.js, GFM table support via Turndown plugin
  - Clip user-selected text as markdown (when text is selected before clicking)
  - Custom Turndown rules for `<figure>` with captions, `<video>` elements, and `<iframe>` embeds
  - Optional YAML frontmatter with title, author, source URL, and capture date
  - Copy to clipboard and download as `.md` file
- Shared URL parser (`src/shared/url-parser.ts`) for Slack URL detection across popup and content script
- YAML frontmatter generation with fixed default Slack template (title, source, workspace, channel, dates, message count, tags)
- Source category auto-detection: `slack-channel`, `slack-private-channel`, `slack-dm`, `slack-group-dm`
- `team.info` API call for workspace name and domain in frontmatter
- Frontmatter on/off toggle in popup ("Include YAML frontmatter" checkbox)
- `{{variable|filter}}` template engine for customizable frontmatter fields
- Built-in templates: Slack Default, Slack Detailed, and Web Clip Default
- Options/settings page (gear icon) for creating, editing, and managing custom frontmatter templates
- Live YAML preview in template editor
- 8 template filters: `date`, `lowercase`, `uppercase`, `default`, `join`, `slug`, `trim`, `truncate`

### Fixed

- **Tab awareness**: popup now queries the active tab URL directly via `chrome.tabs.query()` instead of reading from global session storage — no more stale channel data on non-Slack tabs or when multiple Slack tabs are open
- Token extraction: replaced blob URL page injection with passive `chrome.webRequest` listeners — fixes Slack CSP blocking and compatibility with Slack client-v2 which no longer exposes `window.boot_data` (#1)
- Channel detection: added `CHANNEL_DETECTED` message handler in service worker and `chrome.storage.session.setAccessLevel()` call — content scripts can now write to session storage (MV3 restriction)

### Changed

- Thread replies now render as a grouped blockquote with a `**Thread**` header showing reply count, parent author/time, and a truncated parent message preview for disambiguation
- Removed per-reply `(thread reply)` labels (redundant with the thread header)
- Manifest now includes `scripting`, `contextMenus`, and `offscreen` permissions
- Updated manifest description to cover both web clipping and Slack export
- Updated privacy policy to document all permissions and web clipping data flow

## [0.1.0] — 2026-02-11

### Added

- Initial release: scrape-to-markdown (s2md) — Slack conversation capture
- API-first message capture using Slack session token (auto-detected from `boot_data`)
- Rich text → markdown conversion (bold, italic, strikethrough, code, links, emoji, @mentions, #channels)
- Fallback to legacy `mrkdwn` format for older/bot messages
- Export scopes: last N messages, date range, all messages
- Thread reply expansion (optional, rendered as blockquotes)
- Emoji reaction display
- File attachment references
- Copy to clipboard and download as `.md`
- Progress indicator for paginated exports
- User display name resolution with persistent caching
- Date-grouped output with `## YYYY-MM-DD` headers
- System message formatting (joins, topic changes)
