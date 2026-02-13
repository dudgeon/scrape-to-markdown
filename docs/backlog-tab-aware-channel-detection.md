# Tab-Aware Channel Detection

## Summary

The popup has no awareness of which browser tab is active. It reads the last-written channel from global `chrome.storage.session`, which means it can show a stale Slack channel even when the user is on a non-Slack tab, and it anchors to whichever Slack tab wrote to storage most recently rather than the one the user is currently viewing.

## Bug Report

Observed behavior (reproduced manually):

1. **NYT article in a window with a Slack tab** — popup shows the Slack channel, not an "unsupported page" state.
2. **NYT article in a new window (no Slack tab), refreshed** — popup still shows the Slack channel from the previous window.
3. **Opened a second Slack tab in a different channel** — popup correctly detected the new channel.
4. **Switched back to the first Slack tab, refreshed** — popup still showed the second channel. Detection anchors to the most-recently-written value, not the active tab.

## Root Cause Analysis

### Architecture gap: no tab awareness

The extension has zero `chrome.tabs` API usage. The detection flow is:

```
Content script (app.slack.com only)
  → polls URL every 2s
  → writes channelId/workspaceId to chrome.storage.session (GLOBAL, not per-tab)

Popup
  → sends GET_STATUS once on open
  → service worker reads from chrome.storage.session
  → returns whatever was last written by ANY content script
```

Three compounding issues:

1. **`chrome.storage.session` is global across all tabs.** When multiple Slack tabs are open, whichever content script fires last wins. There is no tab-scoped storage.

2. **Content scripts only run on `app.slack.com`.** When the active tab is a non-Slack page, no content script runs, so storage is never cleared or updated. The popup reads stale data.

3. **Content scripts only write on channel _change_.** If the user switches away from a Slack tab and back (same channel), the content script's `lastChannelId` check suppresses the write — the storage value may already be overwritten by another tab.

### Relevant code paths

- **Content script polling:** `src/content/channel-detector.ts` — `setInterval(check, 2000)` with `lastChannelId` dedup.
- **Service worker storage:** `src/background/index.ts` — `CHANNEL_DETECTED` handler writes to session storage (lines ~94-99). `GET_STATUS` handler reads from session storage (lines ~109-129).
- **Popup init:** `src/popup/popup.ts` — calls `GET_STATUS` once during `init()`, never refreshes.
- **Manifest:** declares `activeTab` permission but never uses it.

### Contrast with userscript

The userscript (`src/userscript/ui.ts`) does not have this bug because it runs directly in the page context — it always reads the current page's URL. The panel re-detects the channel every time it's toggled open.

## Approach

### Recommended: active-tab query at popup open

When the popup opens, it should query the active tab and determine context from that tab — not from global session storage.

**Flow:**

```
Popup opens
  → chrome.tabs.query({ active: true, currentWindow: true })
  → Get active tab's URL
  → If URL matches app.slack.com/client/{workspace}/{channel}:
      → Extract channelId/workspaceId from URL directly
      → Proceed with Slack mode
  → Else:
      → Show "not on a Slack page" state (or future: web clip mode)
```

This eliminates the global storage race entirely for channel detection. The popup always reflects the tab the user is looking at.

**Advantages:**
- Simple — URL parsing is already implemented in `channel-detector.ts`, can be shared.
- No storage migration — global session storage can still hold the token (which _is_ cross-tab).
- Aligns with Phase 4.3 (auto-detect Slack vs. non-Slack) — same active-tab query enables both.

**Disadvantage:**
- Requires the `tabs` permission (or `activeTab` which is already declared) to read the active tab's URL. `activeTab` grants access when the user clicks the extension icon, which is exactly when the popup opens — so no new permissions needed.

### Alternative: per-tab storage

Store channel IDs keyed by tab ID in `chrome.storage.session`. Content scripts would need to know their own tab ID (requires messaging the service worker to get it, since content scripts don't have direct access to `chrome.tabs`). More complex, more storage churn, and still doesn't solve the non-Slack-tab case.

**Not recommended** — the active-tab query approach is simpler and covers all cases.

### What about the content script?

The content script's polling loop and `CHANNEL_DETECTED` messages can remain as-is for now. They serve a secondary purpose: pre-warming the service worker so it's awake and has the token ready when the popup opens. The popup just shouldn't _rely_ on the content script's storage writes for channel identity.

## Relationship to Other Roadmap Items

- **Phase 4.3 (auto-detect Slack vs. non-Slack, switch UI mode):** This fix is a prerequisite. The popup must know the active tab's URL to determine which mode to show. Solving this bug naturally unblocks 4.3.
- **Phase 5.3 (side panel UI):** A side panel would need the same active-tab awareness, since it persists across tab switches.

## Implementation Phases

### A. Popup active-tab detection

1. In `popup.ts`, call `chrome.tabs.query({ active: true, currentWindow: true })` during `init()`.
2. Parse the active tab's URL to extract channelId/workspaceId (reuse `detectChannel()` logic from `channel-detector.ts` — may need to extract the URL parser to a shared util).
3. If the URL is a Slack channel, use those IDs for the `GET_STATUS` / `FETCH_MESSAGES` flow.
4. If not, show a "navigate to a Slack channel" message (placeholder for future web clip mode).

### B. Service worker: accept tab-provided channel in messages

1. Update `GET_STATUS` and `FETCH_MESSAGES` message types to accept optional `channelId`/`workspaceId` fields from the popup.
2. If provided, use those instead of reading from session storage.
3. Fall back to session storage if not provided (backwards compat for any other callers).

### C. Cleanup (optional)

1. Remove the `CHANNEL_DETECTED` storage writes if they're no longer needed.
2. Or keep them for pre-warming / future use by other UI surfaces (side panel, badge).

## Open Questions

- Should the popup poll the active tab periodically (in case the user navigates without closing the popup)? Probably not — the popup closes on any click outside it, so a single check at open time is sufficient.
- Should the content script continue writing to session storage at all? Yes, for now — it's useful for token pre-warming and could support badge text or side panel in the future.

## References

- `chrome.tabs.query()` docs: https://developer.chrome.com/docs/extensions/reference/api/tabs#method-query
- `activeTab` permission: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab — grants access to the active tab when the user invokes the extension (clicks the icon).
