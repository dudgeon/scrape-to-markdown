# Roadmap & Backlog

This is the single source of truth for planned work, priorities, and feature status. Items are ordered by logical build dependency — earlier items unblock later ones.

---

## Status Key

| Status | Meaning |
|--------|---------|
| **Done** | Shipped and working |
| **In Progress** | Actively being built |
| **Up Next** | Prioritized, ready to start |
| **Backlog** | Planned but not yet prioritized |
| **Idea** | Needs research or scoping before committing |

---

## Phase 1: MVP — Slack API + Basic UI

> Core Slack conversation → markdown pipeline. Must be solid before anything else.

| # | Item | Status | Spec |
|---|------|--------|------|
| 1.1 | Token extraction (`boot_data.api_token`) | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 1.2 | `conversations.history` with pagination | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 1.3 | Rich text → markdown conversion (core elements) | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 1.4 | Legacy `mrkdwn` fallback conversion | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 1.5 | User ID → display name resolution + caching | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 1.6 | Popup UI: scope selector, copy, download | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 1.7 | Date grouping in output | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |

---

## Phase 2: Full Scoping + Threads

> Richer Slack export features. Builds on Phase 1's API and conversion pipeline.

| # | Item | Status | Spec |
|---|------|--------|------|
| 2.1 | Date range picker | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 2.2 | Thread reply expansion (`conversations.replies`) | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 2.3 | Reactions in output | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 2.4 | File/attachment references | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 2.5 | Download as `.md` file | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 2.6 | Progress indicator | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |

---

## Phase 3: Clipboard Frontmatter

> Structured metadata on all markdown output. Unlocks note-taking/PKM workflows. Prerequisite for the web clipping feature (which shares the same frontmatter system).

| # | Item | Status | Spec |
|---|------|--------|------|
| 3.1 | YAML frontmatter generation (fixed default template) | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.2 | `team.info` API call for workspace name | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.3 | Source category auto-detection (channel/DM/group DM/thread) | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.4 | Frontmatter on/off toggle in popup | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.5 | Template editor UI (settings page) | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.6 | `{{variable\|filter}}` template engine | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.7 | Participant list for DMs/group DMs (`conversations.members`) | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.8 | Template import/export (JSON) | Backlog | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |

---

## Phase 4: General Web Clipping

> Extends the extension to clip any web page as markdown. Depends on the frontmatter system (Phase 3) for metadata on web clips.

| # | Item | Status | Spec |
|---|------|--------|------|
| 4.1 | Bundle Readability.js + Turndown.js + GFM plugin | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.2 | On-demand content script injection (`chrome.scripting.executeScript`) | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.3 | Popup: auto-detect Slack vs. non-Slack, switch UI mode | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.4 | Article extraction → markdown → clipboard | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.5 | Web clip frontmatter (title, author, source_url, captured) | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.6 | Clip user selection as markdown | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.7 | Custom Turndown rules (images, videos, figures, tables) | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |

---

## Phase 5: Polish + Resilience

> Hardening, UX improvements, and advanced features that build on everything above.

| # | Item | Status | Spec |
|---|------|--------|------|
| 5.1 | DOM fallback mode ("copy visible" for Slack) | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.2 | Multiple token extraction strategies (XHR interception, manual paste) | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.3 | Side panel UI | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.4 | Error handling and retry logic | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.5 | Context menu: "Copy as Markdown" right-click | Backlog | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 5.6 | Keyboard shortcut trigger | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.7 | Export to HTML / JSON formats | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.8 | Configurable output format (template system for body, not just frontmatter) | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |

---

## Priority Rationale

**Phase 3 (Frontmatter) before Phase 4 (Web Clipping)** because:
- The frontmatter template engine is shared infrastructure — both Slack and web clips use it.
- Building it first means web clipping ships with frontmatter from day one.
- Frontmatter is a smaller, self-contained feature that doesn't require new libraries or manifest changes.

**Phase 4 (Web Clipping) before Phase 5 (Polish)** because:
- Web clipping adds the most user value after core Slack features.
- Polish items (DOM fallback, side panel, etc.) are incremental improvements, not new capabilities.

---

## Adding New Backlog Items

When proposing a new feature:

1. **Write a spec** in `docs/backlog-<feature-name>.md` following the pattern of existing backlog specs (Summary, Problem, Approach, Implementation Phases, Open Questions, References).
2. **Add a row** to the appropriate phase table above (or create a new phase if it doesn't fit).
3. **Link the spec** in the row's Spec column.
4. **Set status** to `Backlog` or `Idea`.
5. **Consider dependencies** — place the item after anything it depends on.
