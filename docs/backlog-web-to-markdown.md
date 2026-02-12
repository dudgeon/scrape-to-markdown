# Backlog: General Web Page → Markdown Clipper

**Status**: Backlog (not yet scheduled)
**Depends on**: Phase 1 MVP of Slack Conversation Copier (core extension infrastructure)
**Effort estimate**: Medium (new content script logic + two bundled libraries + popup UI additions)

---

## Summary

Extend the extension beyond Slack-only content: when the user is on any non-Slack web page, detect and extract the article/main content and convert it to clean markdown in the clipboard. This turns the extension from a single-purpose Slack tool into a general-purpose "copy as markdown" utility.

---

## Problem

Copying web content into markdown (for note-taking apps, LLM context, documentation) is a universal friction point — not just a Slack one. Users currently need separate tools (Markdownload, Obsidian Web Clipper, etc.) for general web clipping. Since this extension already has a markdown conversion pipeline and clipboard integration, extending it to arbitrary web pages is a natural fit.

---

## Approach: Readability.js + Turndown.js

### Why not Chrome Reader Mode?

There is **no public Chrome extension API** for Reader Mode. Chrome's built-in Reading Mode renders in an isolated side panel that extensions cannot access. The underlying DOM Distiller library was archived in 2023 and was never exposed to extensions. Every existing web-to-markdown extension bundles its own extraction library.

### Recommended Architecture

The proven pattern (used by Markdownload, LLMFeeder, web2md, and others):

1. **Readability.js** extracts the article content from the messy full-page DOM
2. **Turndown.js** converts the cleaned HTML to markdown

Both libraries are zero-dependency, MIT/Apache-2.0 licensed, and designed to run natively in the browser.

```
User clicks extension on non-Slack page
  → Content script clones document.cloneNode(true)
  → Runs Readability.js on the clone → returns {title, content (HTML), byline, excerpt, siteName, publishedTime, ...}
  → Passes extracted HTML to Turndown.js → returns clean markdown string
  → Markdown (with frontmatter, see backlog-clipboard-frontmatter.md) copied to clipboard
  → Popup shows preview + copy/download controls
```

### Library Details

| Library | npm Package | License | Bundle Size | Dependencies |
|---------|-------------|---------|-------------|--------------|
| Readability | `@mozilla/readability` | Apache-2.0 | ~18 kB minified | None |
| Turndown | `turndown` | MIT | ~18.6 kB packed | None |
| Turndown GFM Plugin | `turndown-plugin-gfm` | MIT | Small add-on | turndown |

**Total additional bundle size**: ~40 kB (negligible for a Chrome extension).

---

## Readability.js — Content Extraction

Mozilla's Readability.js is the library behind Firefox Reader View. It analyzes a DOM document, scores elements by text density and structural importance, and returns the primary content stripped of navigation, ads, sidebars, and clutter.

### Output Object

```javascript
const article = new Readability(doc).parse();
// Returns:
// {
//   title:         "Article Title",
//   content:       "<div>...cleaned HTML...</div>",
//   textContent:   "Plain text version...",
//   length:        12345,           // character count
//   excerpt:       "Article description...",
//   byline:        "Author Name",
//   dir:           "ltr",
//   siteName:      "Example.com",
//   lang:          "en",
//   publishedTime: "2026-01-15T..."
// }
```

All of these fields are available as frontmatter metadata (see [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md)).

### Critical Implementation Notes

- **Readability mutates the DOM** — always pass `document.cloneNode(true)`, never the live document.
- Must run in the **content script** (has DOM access). Service workers have no `document`.
- `charThreshold` option (default 500) controls minimum content length before returning results. May need to lower for short pages.
- Works on most article-style pages. Fails gracefully on highly dynamic/SPA pages (returns null).

---

## Turndown.js — HTML → Markdown Conversion

Turndown walks the DOM tree node by node, applying conversion rules matched by CSS selector. It handles standard HTML elements out of the box and supports custom rules via plugins.

### Configuration for This Extension

```javascript
const turndownService = new TurndownService({
  headingStyle: 'atx',          // # Heading (not underline style)
  bulletListMarker: '-',        // - item (matches Slack converter output)
  codeBlockStyle: 'fenced',    // ```code``` (not indented)
  fence: '```',
  linkStyle: 'inlined',        // [text](url)
  emDelimiter: '*',             // *italic* (matches Slack converter)
  strongDelimiter: '**',        // **bold**
});

// Add GFM plugin for tables + strikethrough
turndownService.use(turndownPluginGfm.gfm);
```

### Custom Rules Needed

| Scenario | Rule |
|----------|------|
| Images with alt text | `![alt](src)` — strip tracking params from URLs |
| Figures with captions | `![caption](src)` |
| Embedded videos | `[Video: title](url)` placeholder |
| Iframes (YouTube, etc.) | Extract `src` URL, render as link |
| `<details>/<summary>` | Preserve as HTML (no markdown equivalent) |
| Data tables vs layout tables | Only convert `<table>` with `<th>` to GFM tables |
| Math (MathJax/KaTeX) | Preserve `$...$` / `$$...$$` if detected |

---

## Extension Integration Design

### Detection: Slack vs. Non-Slack

The extension already runs content scripts on `app.slack.com`. For general web clipping, the content script scope needs to expand:

**Option A — `activeTab` permission (recommended)**:
- The extension already has `activeTab`. When the user clicks the extension icon, the content script can be injected into the current tab regardless of URL.
- Use `chrome.scripting.executeScript()` from the service worker to inject the clipper on demand.
- No additional `host_permissions` needed. Clean permission story.

**Option B — Broad content script match**:
- `"matches": ["<all_urls>"]` in the manifest — loads the content script everywhere.
- Wasteful (runs on every page) and triggers Chrome Web Store review concerns.
- **Not recommended.**

### Popup UI Changes

The popup needs to adapt based on whether the active tab is Slack or a general web page:

| Active Tab | Popup Mode | Controls |
|------------|-----------|----------|
| `app.slack.com/*` | Slack mode | Channel, scope selector, thread options (existing) |
| Any other URL | Web clip mode | Preview of extracted content, copy/download |

Detection logic: check `tab.url` in the popup's `onload`.

### Web Clip Mode Popup

```
┌─────────────────────────────────┐
│  📄 Article Title               │
│  Source: example.com             │
│  Author: Jane Doe               │
│                                  │
│  ┌─────────────────────────────┐ │
│  │ Preview (first ~500 chars)  │ │
│  │ of extracted markdown...    │ │
│  └─────────────────────────────┘ │
│                                  │
│  [Copy Markdown]  [Download .md] │
│                                  │
│  ☐ Include frontmatter           │
│  ⚙ Frontmatter settings         │
└─────────────────────────────────┘
```

### Clipboard Writing

From a content script with `clipboardWrite` permission:

```javascript
await navigator.clipboard.writeText(markdownString);
```

No additional permissions needed — `clipboardWrite` is already in the manifest spec.

---

## Scope & Limitations

### What This Handles Well

- News articles, blog posts, documentation pages
- Pages with clear article structure (headings, paragraphs, lists, code blocks)
- Pages with metadata (author, date, description in `<meta>` tags or JSON-LD)

### What This Does NOT Handle

- SPAs with client-rendered content that isn't in the initial DOM (e.g., infinite scroll feeds)
- Pages behind authentication (extension only sees what the browser renders)
- PDF viewers, embedded documents
- Heavy JavaScript-rendered content that Readability can't parse

### Graceful Degradation

If Readability.js returns null (cannot extract article content):
1. Fall back to `document.body` innerHTML → Turndown (will be messy but functional)
2. Or offer "Copy selection as markdown" if the user has text selected
3. Show a message: "Couldn't extract article content. Try selecting the text you want and using 'Copy selection as markdown.'"

---

## User Selection Clipping

In addition to full-page extraction, support clipping the user's current text selection:

```javascript
const selection = window.getSelection();
if (selection && !selection.isCollapsed) {
  const range = selection.getRangeAt(0);
  const container = document.createElement('div');
  container.appendChild(range.cloneContents());
  const markdown = turndownService.turndown(container);
}
```

This is useful when:
- Readability fails on a page
- The user only wants a specific section
- The page is a non-article (forum, dashboard, etc.)

The popup could offer both options: "Clip article" and "Clip selection" (when a selection exists).

---

## Manifest Changes Required

```diff
  "content_scripts": [
    {
      "matches": ["https://app.slack.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
+ // No new content_scripts entry needed — use chrome.scripting.executeScript()
+ // for on-demand injection on non-Slack pages via activeTab permission.
+
+ "permissions": [
+   "activeTab",
+   "scripting",     // ← NEW: needed for chrome.scripting.executeScript()
+   "clipboardWrite",
+   "storage",
+   "cookies"
+ ],
```

---

## Implementation Phases (Within This Feature)

### Phase A: Basic Clip (MVP for web clipping)

- Bundle Readability.js + Turndown.js (+ GFM plugin)
- On-demand content script injection for non-Slack tabs
- Popup detects Slack vs. non-Slack and switches UI mode
- Extract article → convert to markdown → copy to clipboard
- Basic metadata in header (title, source URL, date)

### Phase B: Selection + Frontmatter

- Clip user selection as markdown
- Configurable YAML frontmatter (see [backlog-clipboard-frontmatter.md](backlog-clipboard-frontmatter.md))
- Turndown custom rules for images, videos, tables
- Download as `.md` file

### Phase C: Polish

- Context menu integration ("Copy as Markdown" right-click option)
- Keyboard shortcut for quick clip
- Side panel preview with editable markdown
- Template selection per-site (URL pattern matching)
- Handle edge cases (math notation, embedded content, figures)

---

## Open Questions

1. **Should this be the same extension or a separate one?** Bundling into one extension is simpler for users but makes the extension scope broader (impacts Chrome Web Store listing/review). A single extension with dual-mode is recommended for now.

2. **Context menu integration**: Right-click → "Copy as Markdown" is very natural. Requires `contextMenus` permission. Worth adding in Phase C?

3. **Image handling**: Should images be inlined as `![alt](url)` (referencing the original URL) or should we offer downloading images? For clipboard use, URL references are simpler. For `.md` file downloads, bundling images into a zip could be a future enhancement.

4. **Site-specific Turndown rules**: Some sites (GitHub, Stack Overflow, Wikipedia) have well-known structures that could benefit from custom extraction rules. Worth a plugin system?

---

## References

- [Markdownload](https://github.com/deathau/markdownload) — Apache-2.0, canonical open-source implementation of this pattern
- [LLMFeeder](https://github.com/jatinkrmalik/LLMFeeder) — Similar concept focused on LLM context feeding
- [Mozilla Readability.js](https://github.com/mozilla/readability) — Apache-2.0
- [Turndown](https://github.com/mixmark-io/turndown) — MIT
- [turndown-plugin-gfm](https://www.npmjs.com/package/turndown-plugin-gfm) — MIT
- [Obsidian Web Clipper](https://help.obsidian.md/web-clipper) — Reference for template/variable system
- [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) — For on-demand content script injection
