# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**scrape-to-markdown** (s2md) — a Chrome Extension (Manifest V3) that scrapes web content and converts it to clean markdown. Currently implements Slack conversation capture via the internal `xoxc-` session token and `conversations.history` API, with configurable YAML frontmatter and a `{{variable|filter}}` template engine. Future phases add general web page clipping (Readability.js + Turndown.js).

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
- **Popup** (`src/popup/`) — Vanilla HTML/CSS/TS UI. Scope selection (last N, date range, all), thread/reaction/file toggles, copy to clipboard, download as `.md`, progress bar. Gear icon opens the options page.
- **Options Page** (`src/options/`) — Vanilla HTML/CSS/TS settings page for frontmatter template editing. Template list, key-value field editor, live preview, create/edit/delete custom templates.

### Key modules

- `src/background/slack-api.ts` — Authenticated Slack API client with cursor-based pagination and 1s rate-limit delays. Auth = `xoxc-` Bearer token + `d` cookie. Exports `ChannelInfo` (channel metadata type used across the codebase) and `fetchTeamInfo()` for workspace metadata.
- `src/background/user-cache.ts` — Two-tier (memory + `chrome.storage.local`) cache for user ID → display name.
- `src/background/markdown/rich-text.ts` — Recursive tree walker converting `rich_text` blocks to markdown. Pure function (accepts resolver callbacks, no Chrome deps).
- `src/background/markdown/mrkdwn.ts` — Regex-based converter for legacy Slack `mrkdwn` format.
- `src/background/markdown/converter.ts` — Top-level orchestrator: messages[] → full markdown document with date grouping, author lines, thread replies, reactions, files. Supports `skipDocumentHeader` option for frontmatter mode.
- `src/background/markdown/formatters.ts` — Date/time formatting, author lines, thread headers (with parent quote + reply count), reaction display, file references.
- `src/background/markdown/frontmatter.ts` — YAML frontmatter generation. Source category detection (`detectSourceCategory`), channel type derivation, YAML serialization (`serializeFrontmatter`), and the top-level `buildSlackFrontmatter()` builder (Phase A fallback). `buildFrontmatterFromTemplate()` resolves user-configured templates via the template engine. `buildSlackTemplateContext()` maps export data to the flat variable namespace. All pure functions.
- `src/background/markdown/template-engine.ts` — `{{variable|filter}}` template engine. Parses expressions, resolves variables from a context, applies filter chains (date, lowercase, uppercase, default, join, slug, trim, truncate). Type-preserving: single-expression values retain their original type. Pure functions, no Chrome deps.
- `src/shared/default-templates.ts` — `FrontmatterTemplate` and `TemplateStore` types + `DEFAULT_TEMPLATES` constant (Slack Default, Slack Detailed, Web Clip Default).
- `src/shared/template-storage.ts` — `chrome.storage.sync` wrapper for template CRUD. `loadTemplates()` merges stored with defaults, `getActiveTemplate(category)` finds the enabled template. Pure helper functions (`mergeWithDefaults`, `findActiveTemplate`) exported for testing.

### Message protocol

Defined in `src/types/messages.ts`. Popup sends `GET_STATUS` or `FETCH_MESSAGES` to service worker, gets back `StatusResponse` or `FetchMessagesResponse`. Service worker sends `PROGRESS` updates during long operations.

## Type system

- `src/types/slack-api.ts` — All Slack API response types, `RichTextBlock` tree, `InlineElement` variants
- `src/types/messages.ts` — Extension message protocol
- `src/shared/constants.ts` — Storage keys, API base URL, rate limit delay
- `src/background/slack-api.ts` — `ChannelInfo` (channel metadata struct used by frontmatter and converter)

### Where types live

- **API response shapes** (`*Response`) → `src/types/slack-api.ts`
- **Extension message protocol** → `src/types/messages.ts`
- **Domain types derived from API data** (e.g., `ChannelInfo`) → the module that produces them (e.g., `slack-api.ts`). Other modules import from there — **do not duplicate type definitions**.
- **Template types** (`FrontmatterTemplate`, `TemplateStore`) → `src/shared/default-templates.ts`. Template engine types (`TemplateContext`, `TemplateFilter`) → `src/background/markdown/template-engine.ts`.
- **Module-local types** (e.g., `FrontmatterContext`) → the module that uses them, exported for test access.

## Testing

Tests live in `tests/` and cover the pure-function modules. Chrome API interactions are tested manually by loading the extension. Test files mirror source modules: `converter.test.ts`, `rich-text.test.ts`, `mrkdwn.test.ts`, `frontmatter.test.ts`, `template-engine.test.ts`, `template-storage.test.ts`. Use factory helpers (e.g., `makeMessage()`, `makeChannel()`) for test data — check existing test files for patterns before creating new ones.

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

### Spec-before-code rule

**Always write the spec and update the roadmap before touching source files** — even for changes that feel small. Output format changes, markdown structure tweaks, and anything affecting LLM-consumed output are design decisions that deserve a written rationale. The spec doesn't need to be long, but it must exist before the first edit to `src/`.

### When implementing a feature

1. **Check the roadmap** for the item's status and dependencies. Don't start work on items whose dependencies aren't Done.
2. **Read the full spec** for the feature before writing code.
3. **Update the roadmap** status (`In Progress` → `Done`) as you work.
4. **Update CLAUDE.md** Architecture/Commands sections if the implementation changes the project structure.

### Research discipline

When prior conversation context or existing specs already contain enough information to act, proceed to spec-writing and implementation. Don't spawn research tasks or web searches to "validate" what you already know — this leads to spiraling. Research is for genuinely unknown territory (new APIs, unfamiliar libraries), not for double-checking decisions that are already made.

## Multi-Agent Coordination

Multiple Claude Code agents may work on this repo concurrently on the same branch. Follow these rules to minimize merge conflicts:

- **Prefer creating new files** over modifying shared ones. A new module with a small integration touch is better than heavy edits to a shared file.
- **High-contention files** — these are modified by almost every feature. Touch them minimally and avoid reformatting unrelated lines:
  - `src/background/index.ts` (service worker orchestration)
  - `src/popup/popup.ts` and `src/popup/popup.html` (UI)
  - `src/types/messages.ts` (message protocol)
- **Low-contention files** — safe to create or heavily modify:
  - New modules under `src/background/markdown/`
  - New test files under `tests/`
  - New spec files under `docs/`
- **When adding a new option/toggle**, keep changes to popup.html and popup.ts as small as possible (one checkbox line, one element reference, one property in the request object).
- **Run `npm test` and `npm run typecheck`** before considering work complete. Do not commit code that breaks existing tests. If a test from another agent is failing, note it but do not fix or delete it.

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
- **Fully implemented spec/PRD** → move the spec file from `docs/` to `docs/archive/` once all items in the spec are Done. Update any roadmap links to point to the new path.

The README is the user-facing doc. CLAUDE.md is the developer-facing doc. The roadmap is the planning doc. All three must stay current. The `docs/archive/` folder holds completed specs for historical reference.
