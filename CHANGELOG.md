# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- YAML frontmatter generation with fixed default Slack template (title, source, workspace, channel, dates, message count, tags)
- Source category auto-detection: `slack-channel`, `slack-private-channel`, `slack-dm`, `slack-group-dm`
- `team.info` API call for workspace name and domain in frontmatter
- Frontmatter on/off toggle in popup ("Include YAML frontmatter" checkbox)
- `{{variable|filter}}` template engine for customizable frontmatter fields
- Built-in templates: Slack Default and Slack Detailed
- Options/settings page (gear icon) for creating, editing, and managing custom frontmatter templates
- Live YAML preview in template editor
- 8 template filters: `date`, `lowercase`, `uppercase`, `default`, `join`, `slug`, `trim`, `truncate`
- Flow diagram in README
- `engines` field in `package.json` requiring Node >= 20

### Changed

- Thread replies now render as a grouped blockquote with a `**Thread**` header showing reply count, parent author/time, and a truncated parent message preview for disambiguation
- Removed per-reply `(thread reply)` labels (redundant with the thread header)

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
