# Backlog: README, Changelog, and Build Versioning

**Status**: Backlog (not yet scheduled)
**Depends on**: Phase 1 MVP complete (current state — core Slack capture works)
**Effort estimate**: Small-Medium (documentation + minor build config)

---

## Summary

Four tightly coupled improvements to make the extension installable, discoverable, and version-trackable by end users:

1. **README overhaul** — detailed install instructions for loading the unpacked extension in Chrome, plus comprehensive feature descriptions
2. **User-facing changelog** — `CHANGELOG.md` tied to build/version numbers so users know what changed
3. **Build versioning** — inject a build number into the extension manifest and UI so users can identify their installed version
4. **CLAUDE.md maintenance rule** — ensure major feature changes propagate to README and changelog descriptions

---

## 1. README Overhaul

### Current State

The [README.md](../README.md) is a single line: `"a simple slack >> markdown browser extension"`. It needs to become the primary user-facing document.

### Target Sections

#### a) Installation Instructions (Unpacked Extension)

Step-by-step guide for installing from source (this is not published to the Chrome Web Store):

```markdown
## Installation

This extension is distributed as an **unpacked Chrome extension**. Follow these steps to install it:

### Prerequisites
- Google Chrome (or any Chromium-based browser: Edge, Brave, Arc, etc.)

### Steps

1. **Download the extension**
   - Go to the [Releases page](link) and download the latest `.zip` file
   - Extract the zip to a folder on your computer (e.g., `~/slack-copier/`)
   - Alternatively, clone this repo and run `npm install && npm run build` — the built extension will be in the `dist/` folder

2. **Enable Developer Mode in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Toggle **Developer mode** ON (switch in the top-right corner)

3. **Load the extension**
   - Click **"Load unpacked"** (top-left)
   - Select the `dist/` folder (the folder containing `manifest.json`)
   - The extension icon should appear in your Chrome toolbar

4. **Pin the extension** (recommended)
   - Click the puzzle-piece icon in the Chrome toolbar
   - Find "Slack Conversation Copier" and click the pin icon

5. **Verify it works**
   - Navigate to any Slack channel at `app.slack.com`
   - Click the extension icon — it should detect the channel automatically

### Updating
When a new version is available:
1. Download/pull the latest version
2. If building from source: `npm run build`
3. Go to `chrome://extensions/`
4. Click the refresh icon on the Slack Conversation Copier card
```

#### b) Feature Descriptions

Document all capture modalities and features. Structure:

```markdown
## Features

### Capture Modes

| Mode | Description | How |
|------|-------------|-----|
| **Last N messages** | Export the most recent 25–500 messages from the current channel | Select count from dropdown in popup |
| **Date range** | Export all messages between two dates | Set From/To dates in popup |
| **All messages** | Export the entire channel history (paginated, may take time for large channels) | Select "All messages" scope |

### Thread Handling
- **Include thread replies**: Optionally expand threaded conversations inline, rendered as blockquotes beneath the parent message
- Thread replies include their own author and timestamp

### Output Options
- **Reactions**: Include emoji reaction counts on messages (`:thumbsup: 3 · :heart: 1`)
- **File references**: Include attached file names with links (`📎 [filename.pdf](url)`)

### Markdown Conversion
- Full `rich_text` block conversion (bold, italic, strikethrough, code, links, emoji, @mentions, #channels)
- Fallback to Slack's legacy `mrkdwn` format for older/bot messages
- Messages grouped by date with `## YYYY-MM-DD` headers
- Document header with channel name, export date, and message count

### Export Actions
- **Copy to clipboard** — one-click copy of the full markdown
- **Download as .md** — saves a file named `#channel-YYYY-MM-DD.md`
```

**Note**: When the frontmatter editing feature (from the web-to-markdown backlog) ships, add a "Frontmatter" section here describing the configurable YAML frontmatter.

#### c) Other README Sections

- **How It Works** — brief (3-sentence) explanation of the API-first approach with DOM fallback
- **Privacy & Security** — tokens stored only in session storage, read-only API calls, never synced
- **Development** — `npm install`, `npm run dev`, `npm run build`, `npm test`
- **Version** — show current version and link to CHANGELOG
- **Known Limitations** — virtual scroll (why API is primary), enterprise grid not tested, rate limits on large channels

### Implementation Notes

- Use shields.io badge for version: `![Version](https://img.shields.io/badge/version-X.Y.Z-blue)` (manually updated, or auto-generated in CI if added later)
- Keep the README focused on _users_, not developers. Dev details stay in CLAUDE.md and the spec.

---

## 2. User-Facing Changelog

### File: `CHANGELOG.md`

Follow [Keep a Changelog](https://keepachangelog.com/) format with semantic versioning.

### Format

```markdown
# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-02-XX

### Added
- Initial release: Slack Conversation Copier MVP
- API-first message capture using Slack session token (auto-detected)
- Rich text → Markdown conversion (bold, italic, strike, code, links, emoji, mentions)
- Fallback to legacy `mrkdwn` format for older/bot messages
- Export scopes: Last N messages, date range, all messages
- Thread reply expansion (optional, rendered as blockquotes)
- Emoji reaction display
- File attachment references
- Copy to clipboard and download as `.md`
- Progress indicator for paginated exports
- User display name resolution with caching
```

### Versioning Scheme

Use **semver** (`MAJOR.MINOR.PATCH`) matching the manifest `version` field:
- **MAJOR**: Breaking changes to output format or workflow
- **MINOR**: New features (new capture mode, new export format, web clipping)
- **PATCH**: Bug fixes, conversion improvements, UI tweaks

The version string already exists in two places: `package.json` (`"version": "1.0.0"`) and `src/manifest.json` (`"version": "0.1.0"`). These should be synced — use the manifest version as the source of truth since that's what Chrome displays. Update `package.json` to match.

### User-Visible Version Display

Add the version to the popup UI footer so users can verify which version they have installed:

```html
<!-- bottom of popup.html -->
<footer class="version">v0.1.0</footer>
```

This must be auto-injected at build time (see section 4).

---

## 3. Build Versioning

### Problem

Currently the version is hardcoded in `src/manifest.json` and `package.json`. There's no automated way to stamp builds, and the popup doesn't show the version. Users have no way to know which version they're running without inspecting `chrome://extensions/`.

### Approach: Single Source of Truth in `package.json`

1. **`package.json`** holds the canonical version (aligned with manifest)
2. **Build step** reads `package.json` version and:
   - Writes it into `src/manifest.json` (or the Vite build injects it)
   - Makes it available as a compile-time constant for the popup UI
3. **Popup** displays the version in a footer element

### Implementation Plan

#### a) Vite `define` for compile-time version constant

In `vite.config.ts`:

```typescript
import pkg from './package.json';

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(pkg.version),
  },
  // ... existing config
});
```

Then in `popup.ts`:

```typescript
declare const __BUILD_VERSION__: string;

// In init() or at module level:
const versionEl = document.querySelector('.version');
if (versionEl) versionEl.textContent = `v${__BUILD_VERSION__}`;
```

#### b) Manifest version sync

Option 1 — **Manual**: just keep them in sync by hand (simplest, acceptable at this scale).

Option 2 — **Build script**: add a prebuild script that reads `package.json` version and writes it to `src/manifest.json`:

```json
{
  "scripts": {
    "prebuild": "node -e \"const m=require('./src/manifest.json'); const p=require('./package.json'); m.version=p.version; require('fs').writeFileSync('./src/manifest.json', JSON.stringify(m,null,2)+'\\n')\"",
    "build": "tsc --noEmit && vite build"
  }
}
```

Option 2 is recommended — eliminates drift.

#### c) Version bump workflow

For now, manual: bump version in `package.json`, run `npm run build`, update `CHANGELOG.md`. If CI is added later, this can be automated with `npm version patch/minor/major` + a changelog generator.

---

## 4. CLAUDE.md Maintenance Rule

### Problem

As features are added, the README feature descriptions and CLAUDE.md "Current State" / "Architecture" sections can drift from reality. Major changes (new capture modes, new UI, new export formats) need to propagate to user-facing docs.

### Rule to Add to CLAUDE.md

Add a new section to `CLAUDE.md`:

```markdown
## Documentation Maintenance

When implementing changes that meet ANY of these criteria, update the corresponding docs:

- **New feature or capture mode** → update README.md "Features" section + CHANGELOG.md
- **New UI controls or export options** → update README.md "Features" section
- **Architecture change** (new component, changed message flow) → update CLAUDE.md "Architecture" section
- **Changed output format** → update README.md + spec doc conversion tables
- **Version bump** → update CHANGELOG.md entry, ensure package.json and manifest.json versions match
- **Removed or deprecated feature** → update README.md to remove, add CHANGELOG "Removed" entry

The README is the user-facing doc. CLAUDE.md is the developer-facing doc. Both must stay current.
```

### Also Update CLAUDE.md "Current State"

The current CLAUDE.md says:

> This is a **greenfield project** with no implementation code yet.

This is stale — Phase 1 MVP is implemented (content script, service worker, popup, markdown converter, user cache, API client all exist). The "Current State" section must be updated to reflect reality.

---

## Implementation Checklist

When this backlog item is picked up:

- [ ] Sync `package.json` version to `0.1.0` (matching manifest)
- [ ] Add `__BUILD_VERSION__` define to `vite.config.ts`
- [ ] Add version footer element to `popup.html`
- [ ] Wire up version display in `popup.ts`
- [ ] Add prebuild script for manifest version sync (or keep manual)
- [ ] Write full `README.md` with install instructions, features, privacy, dev setup, version
- [ ] Create `CHANGELOG.md` with `[0.1.0]` entry covering all existing features
- [ ] Add "Documentation Maintenance" section to `CLAUDE.md`
- [ ] Update `CLAUDE.md` "Current State" to reflect that Phase 1 MVP is implemented
- [ ] Verify version shows correctly in popup after build

---

## Open Questions

1. **GitHub Releases**: Should we create GitHub releases with attached `dist/` zips? This would give users a clean download link for the README install instructions. Low effort if the repo is already on GitHub.

2. **Auto-update notification**: Chrome doesn't auto-update unpacked extensions. Should the popup check the GitHub releases API for a newer version and show a "Update available" badge? Nice-to-have, probably Phase 3.

3. **Build number vs. version**: The user asked about "build number." Semver (`0.1.0`) is sufficient for tracking — a separate incrementing build number adds complexity without clear benefit at this scale. If CI is added, the git SHA or CI build number could be appended (e.g., `0.1.0+build.42`), but that's overkill for now.
