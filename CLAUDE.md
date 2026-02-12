# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**scrape-to-markdown** (s2md) — a Chrome Extension (Manifest V3) that scrapes web content and converts it to clean markdown. Currently implements Slack conversation capture via the internal `xoxc-` session token and `conversations.history` API. Future phases add general web page clipping (Readability.js + Turndown.js) and configurable YAML frontmatter.

The Slack feature specification lives in `docs/slack-convo-copier-spec.md`. See `docs/ROADMAP.md` for the full feature roadmap.

## Commands

Requires Node >= 20 (`.nvmrc` is set to 20).

- `npm run build` — Typecheck + production build to `dist/`
- `npm run dev` — Vite dev server with HMR
- `npm run typecheck` — TypeScript check only
- `npm test` — Run all Vitest tests
- `npm run test:watch` — Run tests in watch mode

To load the extension: open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `dist/` folder.

## Architecture

Three components communicate via `chrome.runtime.sendMessage`:

- **Content Script** (`src/content/`) — Runs on `app.slack.com`. Injects a blob-URL page script to read `window.boot_data.api_token`, stores the `xoxc-` token in `chrome.storage.session`. Polls the URL to detect channel navigation.
- **Service Worker** (`src/background/`) — Message router that orchestrates: Slack API calls → user name resolution → markdown conversion. Handles `GET_STATUS` and `FETCH_MESSAGES` message types. Sends `PROGRESS` messages back to the popup.
- **Popup** (`src/popup/`) — Vanilla HTML/CSS/TS UI. Scope selection (last N, date range, all), thread/reaction/file toggles, copy to clipboard, download as `.md`, progress bar.

### Key modules

- `src/background/slack-api.ts` — Authenticated Slack API client with cursor-based pagination and 1s rate-limit delays. Auth = `xoxc-` Bearer token + `d` cookie.
- `src/background/user-cache.ts` — Two-tier (memory + `chrome.storage.local`) cache for user ID → display name.
- `src/background/markdown/rich-text.ts` — Recursive tree walker converting `rich_text` blocks to markdown. Pure function (accepts resolver callbacks, no Chrome deps).
- `src/background/markdown/mrkdwn.ts` — Regex-based converter for legacy Slack `mrkdwn` format.
- `src/background/markdown/converter.ts` — Top-level orchestrator: messages[] → full markdown document with date grouping, author lines, thread replies, reactions, files.
- `src/background/markdown/formatters.ts` — Date/time formatting, author lines, reaction display, file references.

### Message protocol

Defined in `src/types/messages.ts`. Popup sends `GET_STATUS` or `FETCH_MESSAGES` to service worker, gets back `StatusResponse` or `FetchMessagesResponse`. Service worker sends `PROGRESS` updates during long operations.

## Type system

- `src/types/slack-api.ts` — All Slack API response types, `RichTextBlock` tree, `InlineElement` variants
- `src/types/messages.ts` — Extension message protocol
- `src/shared/constants.ts` — Storage keys, API base URL, rate limit delay

## Testing

Tests live in `tests/` and cover the pure-function markdown conversion modules (42 tests across 3 files). Chrome API interactions are tested manually by loading the extension.

## Build Versioning

`package.json` version is the source of truth. `vite.config.ts` injects it as `__BUILD_VERSION__` at compile time. The popup footer displays it. When bumping version: update `package.json`, `src/manifest.json`, and add a `CHANGELOG.md` entry.

## Gotchas

- **Node >= 20 required.** Vite 5, CRXJS, and Vitest all depend on packages that need Node 20+. The `.nvmrc` is set to `20`. Run `nvm use` before any npm commands.
- **CRXJS does not handle page-world scripts.** The injected script that reads `window.boot_data` must run in the page context (not the extension isolated world). CRXJS can't bundle this as a separate entry. Solution: inline the code as a string in `src/content/token-extractor.ts` and inject via blob URL. Do NOT try to use `chrome.runtime.getURL()` with a separate `.ts` file — CRXJS won't include it in `web_accessible_resources`.
- **`chrome.storage.get()` returns `Record<string, {}>`.** With `strict: true`, values need explicit `as` casts (e.g., `result[KEY] as string | undefined`). Same applies to `chrome.cookies.get()`.
- **`@crxjs/vite-plugin@beta`** is used because the stable 2.0.0 release was not available at build time. The beta works with Vite 5 but is marked deprecated. Monitor for a stable release.
- **`__BUILD_VERSION__`** is a Vite `define` constant. Any TS file using it must include `declare const __BUILD_VERSION__: string;` for the type checker.

## Roadmap & Backlog

The roadmap lives at `docs/ROADMAP.md`. It is the single source of truth for planned work, priorities, and feature status.

### When researching/planning a new feature

1. **Read the roadmap first** (`docs/ROADMAP.md`) to understand what exists, what's in progress, and what's planned.
2. **Read related specs** before writing a new one — check `docs/` for existing specs that overlap.
3. **Write a spec** at `docs/backlog-<feature-name>.md`. Follow this structure:
   - Summary (1-2 sentences)
   - Problem (why this matters)
   - Approach (technical strategy, alternatives considered, recommendation)
   - Library/API details (with concrete package names, sizes, licenses)
   - Integration design (how it fits into the existing extension architecture)
   - Implementation phases (A/B/C within the feature)
   - Open questions
   - References (links to docs, libraries, prior art)
4. **Add entries to the roadmap** — place them in the correct phase based on dependencies, link back to the spec.
5. **Cross-reference related specs** — if your feature depends on or pairs with another, link between them.

### When implementing a feature

1. **Check the roadmap** for the item's status and dependencies. Don't start work on items whose dependencies aren't Done.
2. **Read the full spec** for the feature before writing code.
3. **Update the roadmap** status (`In Progress` → `Done`) as you work.
4. **Update CLAUDE.md** Architecture/Commands sections if the implementation changes the project structure.

## Documentation Maintenance

When implementing changes that meet ANY of these criteria, update the corresponding docs:

- **New feature or capture mode** → update `README.md` "Features" section + `CHANGELOG.md`
- **New UI controls or export options** → update `README.md` "Features" section
- **Architecture change** (new component, changed message flow) → update this file's "Architecture" section
- **Changed output format** → update `README.md` + spec doc conversion tables
- **Version bump** → update `CHANGELOG.md` entry, ensure `package.json` and `src/manifest.json` versions match
- **Removed or deprecated feature** → update `README.md` to remove, add `CHANGELOG.md` "Removed" entry
- **New backlog spec** → add to `docs/ROADMAP.md` with correct phase and status
- **Completed backlog item** → mark as Done in `docs/ROADMAP.md`

The README is the user-facing doc. CLAUDE.md is the developer-facing doc. The roadmap is the planning doc. All three must stay current.
