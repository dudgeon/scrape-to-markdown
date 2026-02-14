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
| 1.1 | Token extraction (passive `chrome.webRequest` capture) | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
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
| 2.7 | Thread formatting for LLM readability (header + parent quote + grouped block) | Done | [backlog-thread-formatting.md](archive/backlog-thread-formatting.md) |

---

## Phase 3: Clipboard Frontmatter

> Structured metadata on all markdown output. Unlocks note-taking/PKM workflows. Prerequisite for the web clipping feature (which shares the same frontmatter system).

| # | Item | Status | Spec |
|---|------|--------|------|
| 3.1 | YAML frontmatter generation (fixed default template) | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.2 | `team.info` API call for workspace name | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.3 | Source category auto-detection (channel/DM/group DM/thread) | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.4 | Frontmatter on/off toggle in popup | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.5 | Template editor UI (settings page) | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.6 | `{{variable\|filter}}` template engine | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |
| 3.7 | Participant list for DMs/group DMs (`conversations.members`) | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |

---

## Phase 4: General Web Clipping

> Extends the extension to clip any web page as markdown. Depends on the frontmatter system (Phase 3) for metadata on web clips.

| # | Item | Status | Spec |
|---|------|--------|------|
| 4.1 | Bundle Readability.js + Turndown.js + GFM plugin | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.2 | On-demand content script injection (`chrome.scripting.executeScript`) | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.3 | Popup: auto-detect Slack vs. non-Slack, switch UI mode | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.4 | Article extraction → markdown → clipboard | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.5 | Web clip frontmatter (title, author, source_url, captured) | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.6 | Clip user selection as markdown | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 4.7 | Custom Turndown rules (images, videos, figures, tables) | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |

---

## Unreads Pane Support (Future)

> Scraping the `/unreads` view. Depends on `client.counts` undocumented API. See research notes in project history.

| # | Item | Status | Notes |
|---|------|--------|-------|
| U.1 | Detect `/unreads` URL and branch to unreads code path | Backlog | Content script URL parser needs to handle literal `unreads` segment |
| U.2 | `client.counts` → identify channels with unreads | Backlog | Single API call, returns all unread channels/DMs/MPIMs |
| U.3 | Fetch unread messages per channel (`conversations.info` + `conversations.history`) | Backlog | 2 API calls per unread channel; consider user-selectable channel list |
| U.4 | Multi-channel markdown output with `## #channel-name` section headers | Backlog | — |
| U.5 | Thread replies within unreads scrape | Backlog | Requires `conversations.replies` per thread parent — multiplies API calls significantly. Deferred. |
| U.6 | Collapsed conversation handling | Backlog | DOM-based approach impractical (double virtual scrolling, lazy-loaded sections). API-only path avoids this entirely. |

---

## Platform Abstraction + Tampermonkey Userscript

> Extract Chrome-specific code behind interfaces. Ship a Tampermonkey userscript as an alternative distribution for environments where unpacked extensions are disabled. Depends on stable core pipeline (Phases 1–3).

| # | Item | Status | Spec |
|---|------|--------|------|
| P.A | Interface extraction + extension adapters (refactor, no behavior change) | Done | [backlog-platform-abstraction-userscript.md](archive/backlog-platform-abstraction-userscript.md) |
| P.B | Core orchestrator extraction (`export-slack.ts`) | Done | [backlog-platform-abstraction-userscript.md](archive/backlog-platform-abstraction-userscript.md) |
| P.C | Userscript adapters + floating panel UI + build config | Done | [backlog-platform-abstraction-userscript.md](archive/backlog-platform-abstraction-userscript.md) |

---

## Phase 5: Polish + Resilience

> Hardening, UX improvements, and advanced features that build on everything above.

| # | Item | Status | Spec |
|---|------|--------|------|
| 5.0a | **Bug:** Popup has no tab awareness — shows stale Slack channel regardless of active tab | Done | [backlog-tab-aware-channel-detection.md](archive/backlog-tab-aware-channel-detection.md) |
| 5.0 | README overhaul (install instructions, features, privacy) | Done | [backlog-readme-changelog-versioning.md](archive/backlog-readme-changelog-versioning.md) |
| 5.1 | DOM fallback mode ("copy visible" for Slack) | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.2 | ~~Multiple token extraction strategies~~ — solved by `chrome.webRequest` | Done | — |
| 5.3 | Side panel UI | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.4 | Error handling and retry logic | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.5 | Context menu: "Copy as Markdown" right-click | Done | [backlog-web-to-markdown.md](backlog-web-to-markdown.md) |
| 5.6 | Keyboard shortcut trigger | Done | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.7 | Export to HTML / JSON formats | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.8 | Configurable output format (template system for body, not just frontmatter) | Backlog | [slack-convo-copier-spec.md](slack-convo-copier-spec.md) |
| 5.9 | Template import/export (JSON) | Done | [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md) |

---

## Priority Rationale

**Phase 3 (Frontmatter) before Phase 4 (Web Clipping)** because:
- The frontmatter template engine is shared infrastructure — both Slack and web clips use it.
- Building it first means web clipping ships with frontmatter from day one.
- Frontmatter is a smaller, self-contained feature that doesn't require new libraries or manifest changes.

**Platform Abstraction can run in parallel with Phase 4** because:
- It only touches the Chrome-coupling seam, not the markdown/template logic that web clipping extends.
- P.A and P.B are pure refactors with no behavior change — low conflict risk.
- P.C (userscript) is a new entry point, not a modification to existing code.

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
