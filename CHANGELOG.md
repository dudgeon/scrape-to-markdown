# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-02-11

### Added

- Initial release: Slack Conversation Copier
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
