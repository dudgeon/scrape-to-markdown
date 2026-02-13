# Backlog: Platform Abstraction + Tampermonkey Userscript

**Status**: Backlog
**Depends on**: Phase 1–3 (core Slack pipeline + frontmatter must be stable)
**Effort estimate**: Medium (interface extraction + new adapters + userscript UI + build config)

---

## Summary

Extract platform-specific Chrome APIs behind interfaces so the same core logic powers both the Chrome extension and a Tampermonkey userscript. Ship `s2md.user.js` as a single-file alternative distribution at `https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js`.

---

## Problem

The Chrome extension requires either:
- Loading as an unpacked extension (disabled by many enterprise policies), or
- Publishing to the Chrome Web Store (review delays, potential rejection)

Users who can install Tampermonkey from the CWS (widely allowed) but can't sideload unpacked extensions have no path to use s2md. A userscript version removes both blockers while reusing 90%+ of the existing code.

---

## Current Chrome API Coupling

Three modules contain all Chrome-specific calls. Everything else is already pure:

| Module | Chrome APIs used | Call sites |
|---|---|---|
| `src/background/slack-api.ts` | `chrome.storage.session.get()`, `chrome.cookies.get()`, `chrome.storage.session.remove()`, `fetch()` with privileged headers | `getAuth()` (lines 11-23), `slackApiCall()` (lines 25-49) |
| `src/background/user-cache.ts` | `chrome.storage.local.get()`, `chrome.storage.local.set()` | `loadCache()` (line 11), `persistCache()` (line 17) |
| `src/shared/template-storage.ts` | `chrome.storage.sync.get()`, `chrome.storage.sync.set()`, `chrome.storage.sync.remove()` | `loadTemplates()` (line 43), `saveTemplates()` (line 50), `resetTemplates()` (line 63) |

Additional Chrome-only modules (no abstraction needed — extension-only code):
- `src/content/token-extractor.ts` — blob URL injection, `chrome.storage.session`, `chrome.runtime.sendMessage`
- `src/content/channel-detector.ts` — URL polling, `chrome.storage.session`, `chrome.runtime.sendMessage`
- `src/background/index.ts` — `chrome.runtime.onMessage` orchestration
- `src/popup/popup.ts` — `chrome.runtime.sendMessage`, `chrome.runtime.openOptionsPage`

---

## Approach: Interface Extraction

### Three interfaces

```typescript
// src/platform/interfaces.ts

/** Provides the xoxc- token and session cookie. */
export interface AuthProvider {
  getToken(): Promise<string | undefined>;
  getCookie(): Promise<string | undefined>;
  clearToken(): Promise<void>;
}

/**
 * Makes authenticated POST requests to the Slack API.
 * Abstracts fetch() (extension) vs GM_xmlhttpRequest (userscript).
 */
export interface HttpClient {
  post(url: string, headers: Record<string, string>, body: string): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<any>;
  }>;
}

/** Key-value storage for caches and settings. */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
```

### Refactored modules

**`slack-api.ts`** — Replace hardcoded `getAuth()` and `fetch()` with injected `AuthProvider` + `HttpClient`:

```typescript
// Before (current):
async function getAuth() {
  const result = await chrome.storage.session.get(STORAGE_KEYS.TOKEN);
  const cookie = await chrome.cookies.get({ url: 'https://app.slack.com', name: 'd' });
  ...
}
async function slackApiCall<T>(method: string, params: Record<string, string>) {
  const { token, cookie } = await getAuth();
  const response = await fetch(`${SLACK_API_BASE}/${method}`, { ... });
  ...
}

// After (refactored):
let _auth: AuthProvider;
let _http: HttpClient;

export function initSlackApi(auth: AuthProvider, http: HttpClient): void {
  _auth = auth;
  _http = http;
}

async function slackApiCall<T>(method: string, params: Record<string, string>): Promise<T> {
  const token = await _auth.getToken();
  const cookie = await _auth.getCookie();
  if (!token) throw new Error('No token available.');
  if (!cookie) throw new Error('No session cookie found.');

  const response = await _http.post(
    `${SLACK_API_BASE}/${method}`,
    {
      'Authorization': `Bearer ${token}`,
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    new URLSearchParams(params).toString(),
  );
  ...
}
```

All exported functions (`fetchMessages`, `fetchThreadReplies`, etc.) remain unchanged — they call `slackApiCall` which now uses the injected deps.

**`user-cache.ts`** — Replace `chrome.storage.local` with `StorageAdapter`:

```typescript
let _storage: StorageAdapter;

export function initUserCache(storage: StorageAdapter): void {
  _storage = storage;
}

async function loadCache(): Promise<void> {
  if (loaded) return;
  memoryCache = (await _storage.get<UserCacheMap>(STORAGE_KEYS.USER_CACHE)) || {};
  loaded = true;
}
```

**`template-storage.ts`** — Replace `chrome.storage.sync` with `StorageAdapter` in the async functions only. Pure functions (`mergeWithDefaults`, `findActiveTemplate`) are untouched:

```typescript
let _storage: StorageAdapter;

export function initTemplateStorage(storage: StorageAdapter): void {
  _storage = storage;
}

export async function loadTemplates(): Promise<TemplateStore> {
  const stored = await _storage.get<TemplateStore>(STORAGE_KEYS.TEMPLATES);
  return mergeWithDefaults(stored ?? null);
}
```

### Orchestrator extraction

Extract the core export logic from `background/index.ts` into a platform-agnostic function:

```typescript
// src/core/export-slack.ts

export interface ExportSlackOptions {
  channelId: string;
  scope: FetchScope;
  includeThreads: boolean;
  includeReactions: boolean;
  includeFiles: boolean;
  includeFrontmatter: boolean;
  onProgress?: (progress: ProgressInfo) => void;
}

export async function exportSlackChannel(options: ExportSlackOptions): Promise<{
  markdown: string;
  messageCount: number;
}> {
  // Same logic as current handleFetchMessages(), but using
  // onProgress callback instead of chrome.runtime.sendMessage
}
```

`background/index.ts` becomes a thin wrapper that calls `exportSlackChannel` and bridges `chrome.runtime.onMessage` ↔ the callback.

---

## Extension Adapter Implementations

Extracted from current code — no behavior change, just moved into adapter files:

```typescript
// src/adapters/extension/auth.ts
export class ExtensionAuthProvider implements AuthProvider {
  async getToken() {
    const result = await chrome.storage.session.get(STORAGE_KEYS.TOKEN);
    return result[STORAGE_KEYS.TOKEN] as string | undefined;
  }
  async getCookie() {
    const cookie = await chrome.cookies.get({ url: 'https://app.slack.com', name: 'd' });
    return cookie ? `d=${cookie.value}` : undefined;
  }
  async clearToken() {
    await chrome.storage.session.remove(STORAGE_KEYS.TOKEN);
  }
}

// src/adapters/extension/http.ts
export class ExtensionHttpClient implements HttpClient {
  async post(url: string, headers: Record<string, string>, body: string) {
    return fetch(url, { method: 'POST', headers, body });
  }
}

// src/adapters/extension/storage.ts
export class ExtensionLocalStorage implements StorageAdapter { /* chrome.storage.local */ }
export class ExtensionSyncStorage implements StorageAdapter { /* chrome.storage.sync */ }
```

---

## Userscript Adapter Implementations

```typescript
// src/adapters/userscript/auth.ts
export class UserscriptAuthProvider implements AuthProvider {
  async getToken() {
    // Direct access — userscript runs in page context
    const bd = (window as any).boot_data;
    const token = bd?.api_token;
    return token?.startsWith('xoxc-') ? token : undefined;
  }
  async getCookie() {
    // GM_xmlhttpRequest sends cookies automatically; return a sentinel
    // that the UserscriptHttpClient knows means "use auto-cookies"
    return '__AUTO__';
  }
  async clearToken() { /* no-op — token is on the page, not stored */ }
}

// src/adapters/userscript/http.ts
export class UserscriptHttpClient implements HttpClient {
  post(url: string, headers: Record<string, string>, body: string) {
    return new Promise((resolve, reject) => {
      // Strip the Cookie header — GM_xmlhttpRequest sends cookies automatically
      const { Cookie, ...safeHeaders } = headers;

      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers: safeHeaders,
        data: body,
        onload: (resp) => resolve({
          ok: resp.status >= 200 && resp.status < 300,
          status: resp.status,
          json: () => Promise.resolve(JSON.parse(resp.responseText)),
        }),
        onerror: (err) => reject(new Error(`Network error: ${err.error}`)),
      });
    });
  }
}

// src/adapters/userscript/storage.ts
export class UserscriptStorage implements StorageAdapter {
  async get<T>(key: string) { return GM_getValue(key) as T | undefined; }
  async set(key: string, value: unknown) { GM_setValue(key, value); }
  async remove(key: string) { GM_deleteValue(key); }
}
```

Note: `GM_xmlhttpRequest` bypasses CORS entirely and automatically includes cookies for the target domain. The `Cookie` header is stripped from the explicit headers to avoid duplication — the browser's cookie jar handles it.

---

## Userscript Entry Point + UI

### Entry point

```typescript
// src/userscript/index.ts
import { initSlackApi } from '../background/slack-api';
import { initUserCache } from '../background/user-cache';
import { initTemplateStorage } from '../shared/template-storage';
import { UserscriptAuthProvider } from '../adapters/userscript/auth';
import { UserscriptHttpClient } from '../adapters/userscript/http';
import { UserscriptStorage } from '../adapters/userscript/storage';
import { exportSlackChannel } from '../core/export-slack';
import { injectUI } from './ui';

// Wire up platform adapters
const storage = new UserscriptStorage();
initSlackApi(new UserscriptAuthProvider(), new UserscriptHttpClient());
initUserCache(storage);
initTemplateStorage(storage);

// Channel detection — direct URL parsing (no content script needed)
function detectChannel(): { workspaceId: string; channelId: string } | null {
  const match = location.pathname.match(/^\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i);
  return match ? { workspaceId: match[1], channelId: match[2] } : null;
}

// Inject floating panel and wire up export
injectUI({ detectChannel, exportSlackChannel });
```

### UI

Floating panel injected into the Slack page. Same controls as the popup:
- Scope selector (last N / date range / all)
- Thread, reaction, file, frontmatter toggles
- Copy to clipboard / Download as .md buttons
- Progress indicator

The panel is a `<div>` with a shadow DOM root (isolates styles from Slack's CSS). Toggled by a small floating button in the bottom-right corner.

```
┌─────────────────────────────┐
│  s2md                    ─  │  ← collapse button
├─────────────────────────────┤
│  #channel-name              │
│                             │
│  Scope: [Last 100 ▾]       │
│                             │
│  ☑ Threads  ☑ Reactions     │
│  ☑ Files    ☑ Frontmatter   │
│                             │
│  [Copy]  [Download]         │
│                             │
│  ████████░░ 80%             │
└─────────────────────────────┘
```

---

## Distribution

**Single file:** `s2md.user.js` at the repo root, with a `==UserScript==` header:

```javascript
// ==UserScript==
// @name         scrape-to-markdown (s2md)
// @namespace    https://github.com/dudgeon/scrape-to-markdown
// @version      0.1.0
// @description  Export Slack conversations as clean markdown
// @author       dudgeon
// @match        https://app.slack.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      slack.com
// @updateURL    https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js
// @downloadURL  https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js
// ==/UserScript==
```

**Install URL:** `https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js`

Tampermonkey auto-detects `.user.js` URLs and prompts installation. The `@updateURL` enables automatic updates when the file changes on `main`.

---

## Build Configuration

New build target alongside the existing Vite/CRXJS build:

```jsonc
// package.json scripts (addition)
"build:userscript": "vite build --config vite.userscript.config.ts"
```

```typescript
// vite.userscript.config.ts
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const banner = readFileSync('src/userscript/header.txt', 'utf-8');

export default defineConfig({
  build: {
    lib: {
      entry: 'src/userscript/index.ts',
      formats: ['iife'],
      name: 's2md',
      fileName: () => 's2md.user.js',
    },
    outDir: '.',           // output to repo root
    emptyOutDir: false,    // don't nuke the repo
    rollupOptions: {
      output: { banner },
    },
  },
});
```

This produces a single IIFE-wrapped `s2md.user.js` at the repo root with the `==UserScript==` header prepended.

---

## Implementation Phases

### Phase P.A: Interface extraction + extension adapters (refactor only)

1. Create `src/platform/interfaces.ts` with `AuthProvider`, `HttpClient`, `StorageAdapter`
2. Create `src/adapters/extension/auth.ts`, `http.ts`, `storage.ts` — extract existing Chrome calls
3. Add `init*()` functions to `slack-api.ts`, `user-cache.ts`, `template-storage.ts`
4. Update `background/index.ts` to call `init*()` with extension adapters at startup
5. All existing tests must still pass — behavior is identical

**Acceptance:** `npm test` passes, extension works identically when loaded.

### Phase P.B: Core orchestrator extraction

1. Extract `handleFetchMessages()` body into `src/core/export-slack.ts`
2. Replace `chrome.runtime.sendMessage` progress with callback parameter
3. `background/index.ts` becomes a thin bridge: `chrome.runtime.onMessage` → `exportSlackChannel` → `sendProgress`

**Acceptance:** `npm test` passes, extension works identically.

### Phase P.C: Userscript adapters + UI + build

1. Create `src/adapters/userscript/auth.ts`, `http.ts`, `storage.ts`
2. Create `src/userscript/index.ts` (entry point) and `src/userscript/ui.ts` (floating panel)
3. Create `src/userscript/header.txt` (==UserScript== block)
4. Create `vite.userscript.config.ts`
5. Add `build:userscript` script to `package.json`
6. Build and test manually on `app.slack.com` via Tampermonkey
7. Commit `s2md.user.js` to repo root

**Acceptance:** Tampermonkey installs from GitHub raw URL, exports a Slack channel identically to the extension.

---

## File changes summary

| Action | File | Phase |
|---|---|---|
| **Create** | `src/platform/interfaces.ts` | P.A |
| **Create** | `src/adapters/extension/auth.ts` | P.A |
| **Create** | `src/adapters/extension/http.ts` | P.A |
| **Create** | `src/adapters/extension/storage.ts` | P.A |
| **Modify** | `src/background/slack-api.ts` (~20 lines) | P.A |
| **Modify** | `src/background/user-cache.ts` (~10 lines) | P.A |
| **Modify** | `src/shared/template-storage.ts` (~10 lines) | P.A |
| **Modify** | `src/background/index.ts` (add init calls) | P.A |
| **Create** | `src/core/export-slack.ts` | P.B |
| **Modify** | `src/background/index.ts` (thin wrapper) | P.B |
| **Create** | `src/adapters/userscript/auth.ts` | P.C |
| **Create** | `src/adapters/userscript/http.ts` | P.C |
| **Create** | `src/adapters/userscript/storage.ts` | P.C |
| **Create** | `src/userscript/index.ts` | P.C |
| **Create** | `src/userscript/ui.ts` | P.C |
| **Create** | `src/userscript/header.txt` | P.C |
| **Create** | `vite.userscript.config.ts` | P.C |
| **Create** | `s2md.user.js` (build output, committed) | P.C |

---

## Open Questions

1. **Template editing UI in userscript mode** — The extension has a full options page for template editing. Should the userscript include this (as a modal within the floating panel), or ship with defaults only and defer template customization?
2. **Version sync** — Should the userscript version track `package.json` version, or version independently?
3. **CI build** — Should `build:userscript` run in CI and auto-commit `s2md.user.js` on release, or is manual build-and-commit sufficient?

---

## References

- [Tampermonkey documentation](https://www.tampermonkey.net/documentation.php)
- [`GM_xmlhttpRequest` API](https://www.tampermonkey.net/documentation.php#api:GM_xmlhttpRequest)
- [Shadow DOM for style isolation](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- Existing pure modules: `src/background/markdown/`, `src/shared/default-templates.ts`, `src/background/markdown/template-engine.ts`
