# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**scrape-to-markdown** (s2md) — a Chrome Extension (Manifest V3) and Tampermonkey userscript that scrapes web content and converts it to clean markdown. Two modes: **Slack conversation capture** (via `xoxc-` session token and `conversations.history` API, with threads, reactions, and configurable YAML frontmatter) and **web page clipping** (via Readability.js + Turndown.js, with article extraction, selection clipping, and frontmatter). The popup auto-detects which mode to use based on the active tab URL.

The extension is submitted to the Chrome Web Store (pending review). The userscript (`s2md.user.js`) is an alternative distribution for environments where unpacked extensions are disabled — install via Tampermonkey from the GitHub raw URL.

The Slack feature specification lives in `docs/slack-convo-copier-spec.md`. See `docs/ROADMAP.md` for the full feature roadmap.

## Commands

Requires Node >= 20 (`.nvmrc` is set to 20).

- `npm run build` — Typecheck + production build to `dist/`
- `npm run dev` — Vite dev server with HMR
- `npm run typecheck` — TypeScript check only
- `npm test` — Run all Vitest tests
- `npm run test:watch` — Run tests in watch mode
- `npm run build:userscript` — Build Tampermonkey userscript to `s2md.user.js`
- `npm run typecheck:userscript` — TypeScript check userscript (excludes Chrome APIs)

To load the extension: open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `dist/` folder.

To install the userscript: install Tampermonkey, then open `https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js` — Tampermonkey auto-detects `.user.js` URLs.

## Architecture

### Platform abstraction

Chrome-specific code is isolated behind three interfaces in `src/platform/interfaces.ts`: `AuthProvider`, `HttpClient`, `StorageAdapter`. Both the extension and userscript provide their own implementations.

- `src/adapters/extension/` — Extension adapters wrapping `chrome.storage`, `chrome.cookies`, `fetch()`
- `src/adapters/userscript/` — Userscript adapters wrapping `GM_xmlhttpRequest`, `GM_getValue`/`GM_setValue`, `window.boot_data`
- `src/core/export-slack.ts` — Platform-agnostic orchestrator. Both entry points call `exportSlackChannel()` with an `onProgress` callback.

### Chrome Extension

Four components communicate via `chrome.runtime.sendMessage`:

- **Content Script** (`src/content/`) — Runs on `app.slack.com`. Wakes the service worker (which captures the `xoxc-` token passively via `chrome.webRequest`). Polls the URL to detect channel navigation and stores the channel/workspace IDs in `chrome.storage.session`.
- **Service Worker** (`src/background/`) — Captures the `xoxc-` token passively via `chrome.webRequest` listeners on Slack API traffic (Authorization header and POST body). Routes messages: delegates to `exportSlackChannel()` for `FETCH_MESSAGES`, handles `GET_STATUS` and `CHANNEL_DETECTED` directly. Sends `PROGRESS` messages back to the popup.
- **Popup** (`src/popup/`) — Vanilla HTML/CSS/TS UI. Auto-detects Slack vs. non-Slack tabs via `chrome.tabs.query()`. **Slack mode**: scope selection (last N, date range, all), thread/reaction/file toggles, copy to clipboard, download as `.md`, progress bar. **Web clip mode**: article extraction via `chrome.scripting.executeScript()` + Readability.js + Turndown.js, selection clipping, frontmatter toggle, copy/download. Gear icon opens the options page.
- **Options Page** (`src/options/`) — Vanilla HTML/CSS/TS settings page for frontmatter template editing. Template list, key-value field editor, live preview, create/edit/delete custom templates.

### Tampermonkey Userscript

Single-file IIFE (`s2md.user.js`) built by `vite.userscript.config.ts`. Runs directly on `app.slack.com`:

- **Entry** (`src/userscript/index.ts`) — Wires up userscript adapters, detects channel from URL, injects UI.
- **UI** (`src/userscript/ui.ts`) — Shadow DOM floating panel (bottom-right). Same controls as the popup: scope selector, toggles, copy/download, progress bar. Polls URL for channel changes.

### Key modules

- `src/background/slack-api.ts` — Authenticated Slack API client with cursor-based pagination and 1s rate-limit delays. Uses injected `AuthProvider` + `HttpClient` (call `initSlackApi()` first). Exports `ChannelInfo` (channel metadata type used across the codebase) and `fetchTeamInfo()` for workspace metadata.
- `src/background/user-cache.ts` — Two-tier (memory + storage) cache for user ID → display name. Uses injected `StorageAdapter` (call `initUserCache()` first).
- `src/background/markdown/rich-text.ts` — Recursive tree walker converting `rich_text` blocks to markdown. Pure function (accepts resolver callbacks, no Chrome deps).
- `src/background/markdown/mrkdwn.ts` — Regex-based converter for legacy Slack `mrkdwn` format.
- `src/background/markdown/converter.ts` — Top-level orchestrator: messages[] → full markdown document with date grouping, author lines, thread replies, reactions, files. Supports `skipDocumentHeader` option for frontmatter mode.
- `src/background/markdown/formatters.ts` — Date/time formatting, author lines, thread headers (with parent quote + reply count), reaction display, file references.
- `src/background/markdown/frontmatter.ts` — YAML frontmatter generation. Source category detection (`detectSourceCategory`), channel type derivation, YAML serialization (`serializeFrontmatter`), and the top-level `buildSlackFrontmatter()` builder (Phase A fallback). `buildFrontmatterFromTemplate()` resolves user-configured Slack templates via the template engine. `buildSlackTemplateContext()` maps Slack export data to the flat variable namespace. `buildWebClipTemplateContext()` and `buildWebClipFrontmatterFromTemplate()` do the same for web clips. All pure functions.
- `src/background/markdown/template-engine.ts` — `{{variable|filter}}` template engine. Parses expressions, resolves variables from a context, applies filter chains (date, lowercase, uppercase, default, join, slug, trim, truncate). Type-preserving: single-expression values retain their original type. Pure functions, no Chrome deps.
- `src/shared/default-templates.ts` — `FrontmatterTemplate` and `TemplateStore` types + `DEFAULT_TEMPLATES` constant (Slack Default, Slack Detailed, Web Clip Default).
- `src/shared/template-storage.ts` — Storage-backed template CRUD. Uses injected `StorageAdapter` (call `initTemplateStorage()` first). `loadTemplates()` merges stored with defaults, `getActiveTemplate(category)` finds the enabled template. Pure helper functions (`mergeWithDefaults`, `findActiveTemplate`) exported for testing.
- `src/core/export-slack.ts` — Platform-agnostic export orchestrator. `exportSlackChannel(options)` runs the full pipeline: fetch messages → resolve users → convert to markdown → generate frontmatter. Progress via `onProgress` callback.
- `src/core/clip-page.ts` — Web page clipping. `clipPage(data)` takes raw HTML + URL, runs Readability.js for article extraction, converts to markdown via Turndown.js with GFM plugin and custom rules (figures, video, iframe). Returns `ClipResult` with markdown, title, byline, siteName, excerpt. Supports selection clipping (skips Readability when `selectedHtml` is provided). Pure function — runs in any context with DOM API.
- `src/shared/url-parser.ts` — Pure URL parsing utilities. `parseSlackUrl(url)` extracts workspaceId/channelId from Slack URLs. `isSlackUrl(url)` checks if a URL is on `app.slack.com`. Used by both the popup (for tab detection) and the content script (for channel detection).

### Message protocol

Defined in `src/types/messages.ts`. Popup sends `GET_STATUS` (with optional `channelId`/`workspaceId` from active tab) or `FETCH_MESSAGES` to service worker, gets back `StatusResponse` or `FetchMessagesResponse`. Content script sends `EXTRACT_TOKEN` (wake service worker) and `CHANNEL_DETECTED` (channel navigation). Service worker sends `PROGRESS` updates during long operations. Web clipping does not use the message protocol — the popup handles extraction directly via `chrome.scripting.executeScript()`.

**Every message type in the union must have a matching `case` in the service worker's switch statement.** Silent drops are hard to debug — grep for `case '` in `index.ts` to verify coverage.

## Design Rules

These rules encode lessons from past implementation work. Follow them when adding new features.

1. **Popup has DOM APIs — use them.** The popup runs in a browser context with `DOMParser`, `document.createElement`, etc. When you need to process HTML (Readability, Turndown, DOM manipulation), do it in the popup — don't inject a bundled content script just for processing.
2. **`chrome.scripting.executeScript({ func })` for data extraction only.** Inject a minimal inline function that returns raw data (HTML string, selection text, URL, title). Do heavy processing in the caller (popup or service worker). This avoids separate bundle entry points, CRXJS config, and message-passing complexity.
3. **Shared utils accept primitives, not browser globals.** When extracting code from browser-context modules to `src/shared/`, make the shared version accept `string`/`object` params — never `window.*`, `document.*`, or `chrome.*`. The browser-context caller wraps the shared function with the appropriate global access (see `src/shared/url-parser.ts` as the canonical example).
4. **When spec and implementation diverge, document why.** If you choose a simpler approach than what the spec describes, note the divergence in the retro and update the spec or mark it as superseded. Future readers should not be misled by outdated architecture diagrams.

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

## Debugging Chrome Extension Issues

When debugging runtime issues (token extraction, channel detection, API calls):

1. **Audit the full data flow first.** Trace content-script → service-worker → storage → popup before writing code. Check that every message type has a handler, every storage write has a reader, and every API has the required permissions.
2. **Verify assumptions about external APIs before building solutions.** If you're depending on a page global (like `window.boot_data`), confirm it exists before writing extraction code. Third-party web apps change their internals frequently.
3. **Prefer the browser network layer over page-world injection.** `chrome.webRequest` is more resilient than page-world JS access. It doesn't depend on the page's CSP, global variables, or script loading order.
4. **Check MV3 restrictions.** Key gotchas: session storage is service-worker-only by default, `webRequestBlocking` doesn't exist, content scripts don't auto-inject into existing tabs.
5. **Minimize build-install-test cycles.** Each round requires the user to reinstall the extension and refresh Slack. Batch multiple fixes into one build when possible.
6. **Add a build tag for manual testing.** Append a tag to the version string (e.g., `v0.1.0-webRequest`) to confirm the right build is loaded. Remove it before committing.

## Gotchas

- **Node >= 20 required.** Vite 5, CRXJS, and Vitest all depend on packages that need Node 20+. The `.nvmrc` is set to `20`. Run `nvm use` before any npm commands.
- **Token extraction uses `chrome.webRequest`, not page-world injection.** Slack client-v2 no longer exposes `window.boot_data`. The service worker passively captures the `xoxc-` token from Slack's own HTTP requests (Authorization header or POST body `token=` field). No blob URLs, no CSP concerns.
- **Web clipping uses `chrome.scripting.executeScript` from the popup.** The popup injects an inline function into the active tab to grab `document.documentElement.outerHTML`, then processes it locally with Readability + Turndown. No separate bundled content script needed — the injected function returns raw HTML and the popup has full DOM API for processing.
- **`chrome.storage.session` requires `setAccessLevel` for content script access.** MV3 restricts session storage to the service worker by default. The service worker calls `chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })` at startup so the content script can also read/write session storage.
- **`chrome.storage.get()` returns `Record<string, {}>`.** With `strict: true`, values need explicit `as` casts (e.g., `result[KEY] as string | undefined`). Same applies to `chrome.cookies.get()`.
- **`@crxjs/vite-plugin@beta`** is used because the stable 2.0.0 release was not available at build time. The beta works with Vite 5 but is marked deprecated. Monitor for a stable release.
- **`__BUILD_VERSION__`** is a Vite `define` constant. Any TS file using it must include `declare const __BUILD_VERSION__: string;` for the type checker.
- **Userscript build outputs to repo root.** `vite.userscript.config.ts` writes `s2md.user.js` to `.` (not `dist/`). Vite warns about `build.outDir must not be the same directory of root` — this is expected and harmless.
- **`tsconfig.userscript.json` uses `"types": []`** to exclude `@types/chrome`. This prevents accidental Chrome API usage in userscript code paths. If a module needs Chrome APIs, it shouldn't be in the userscript include list.
- **Platform modules require initialization.** `slack-api.ts`, `user-cache.ts`, and `template-storage.ts` use module-level `_auth`/`_http`/`_storage` vars set by `init*()` functions. The service worker (`src/background/index.ts`), userscript (`src/userscript/index.ts`), and popup (`src/popup/popup.ts` — for template storage only) must call these before any API/storage use.

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

**If the implementation diverges from the spec** (e.g., popup-local processing instead of the spec's content-script injection), that's fine — simpler is better. But document the divergence in the retro and update or supersede the spec so future readers aren't misled.

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
- **Run `npm test`, `npm run typecheck`, and `npm run typecheck:userscript`** before considering work complete. Do not commit code that breaks existing tests. If a test from another agent is failing, note it but do not fix or delete it.
- **Dual-platform rule**: The Chrome extension and Tampermonkey userscript share all code under `src/background/markdown/`, `src/core/`, `src/shared/`, and `src/types/`. Any change to these shared modules affects both platforms. When modifying shared code, verify the userscript typecheck passes (`npm run typecheck:userscript`) — it uses a separate `tsconfig.userscript.json` that excludes Chrome APIs. If a change requires Chrome-specific APIs, it must go in `src/adapters/extension/` or `src/background/index.ts`, never in the shared layer.

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
