# Unreads Pane — Multi-Channel Unread Export

## Summary

Export all unread Slack messages across multiple channels in a single markdown document. When the user navigates to Slack's `/unreads` view and clicks the extension, s2md calls the `client.counts` API to discover channels with unread messages, lets the user select which channels to include, fetches only unread messages per channel, and produces a multi-channel markdown document with channel section headers.

## Problem

Slack's `/unreads` view shows unread messages across all channels, but:

- It uses virtual scrolling — only ~50 messages are in the DOM at a time
- There's no way to copy/export the full unreads view
- Users who want a daily digest or handoff document need to visit each channel individually
- The existing s2md single-channel export requires navigating to each channel one at a time

The unreads export turns a 10-minute manual task (open channel → export → repeat) into a one-click operation.

## Approach: API-Only with `client.counts`

**Rejected: DOM scraping** — Slack's unreads view uses double virtual scrolling (channel list + message list) with lazy-loaded collapsed sections. DOM scraping is fragile and incomplete.

**Chosen: `client.counts` + `conversations.history`** — Two-phase API approach:

1. Call `client.counts` once to discover all channels/DMs/MPIMs with `has_unreads: true` and their `last_read` timestamps
2. For each selected channel, call `conversations.history` with `oldest=last_read` to fetch only unread messages

This mirrors what the Slack web client does internally and reuses the same `xoxc-` token s2md already captures.

---

## API Details

### `client.counts` (undocumented)

**Request:**

```
POST https://slack.com/api/client.counts
Content-Type: application/json
Authorization: Bearer xoxc-...
Cookie: d=xoxd-...

{"org_wide_aware": true, "thread_counts_by_channel": true}
```

**Response:**

```typescript
interface ClientCountsResponse {
  ok: boolean;
  channels: UnreadChannel[];   // public + private channels
  mpims: UnreadChannel[];      // group DMs
  ims: UnreadChannel[];        // 1:1 DMs
  threads: {
    has_unreads: boolean;
    mention_count: number;
    unread_count_by_channel: Record<string, number>;
  };
}

interface UnreadChannel {
  id: string;              // e.g. "C024BE91L"
  last_read: string;       // timestamp of last-read message, e.g. "1713000000.000100"
  latest: string;          // timestamp of newest message
  mention_count: number;   // @mentions directed at user
  has_unreads: boolean;    // whether any messages are unread
}
```

**Risk:** This is an undocumented API. Mitigations:

- Wrap in a single `fetchClientCounts()` function for easy maintenance
- Validate response shape before processing
- Degrade gracefully — show error message suggesting individual channel exports

**References:**

- [cixtor/slackapi](https://github.com/cixtor/slackapi) (Go) — typed `ClientCounts()` implementation
- [emacs-slack](https://github.com/emacs-slack/emacs-slack/blob/master/slack-counts.el) — Emacs Lisp implementation
- [ErikKalkoken/slackApiDoc](https://github.com/ErikKalkoken/slackApiDoc) — undocumented Slack API catalog

### Fetching Unread Messages Per Channel

For each channel where `has_unreads === true`:

```
POST conversations.history
  channel=C024BE91L
  oldest=1713000000.000100   ← last_read from client.counts
  inclusive=false              ← exclude the already-read message
  limit=200
```

This returns only messages the user hasn't seen. Paginate with cursor if `has_more === true`.

**Rate limits:** `conversations.history` is Tier 3 (~50 req/min). s2md already uses 1-second delays between API pages. For 10 channels with ~20 unreads each, that's ~10 API calls (10 seconds). For channels with many unreads, pagination adds more calls.

---

## URL Detection

Extend `parseSlackUrl()` in `src/shared/url-parser.ts` to return a discriminated union:

```typescript
type SlackUrlResult =
  | { type: 'channel'; workspaceId: string; channelId: string }
  | { type: 'unreads'; workspaceId: string }
  | null;
```

Detection patterns:

- **Channel:** `/client/{workspaceId}/{channelId}` (existing)
- **Unreads:** `/client/{workspaceId}/unreads`

The popup reads this result and switches to the appropriate UI mode. The content script detects `/unreads` and stores a mode flag in session storage alongside the workspace ID.

---

## Popup UI: Unreads Mode

The popup gains a third mode (alongside Slack-channel and Web Clip):

```
┌─────────────────────────────────────────────┐
│  scrape-to-markdown                    [⚙]  │
│                                             │
│  Unreads — 42 messages in 5 channels        │
│                                             │
│  ☑ #general (12 messages, 2 mentions)       │
│  ☑ #engineering (8 messages)                │
│  ☑ @alice (15 messages, 5 mentions)         │
│  ☑ @bob, @carol (4 messages)               │
│  ☑ #random (3 messages)                     │
│                                             │
│  ☑ Include threads   ☑ Include reactions    │
│  ☑ Include files     ☑ Include frontmatter  │
│                                             │
│  [Copy to Clipboard]  [Download .md]        │
│                                             │
│  [Progress: Channel 3 of 5 — #engineering]  │
└─────────────────────────────────────────────┘
```

### Flow

1. Popup opens → detects `/unreads` URL → sends `GET_UNREAD_COUNTS` message
2. Service worker calls `client.counts` → responds with channel list
3. Popup renders channel list with checkboxes (all checked by default)
4. User unchecks channels they don't want, toggles options
5. User clicks Copy/Download → sends `FETCH_UNREADS` message
6. Service worker fetches per-channel, sends `PROGRESS` updates
7. Returns combined markdown document

### Channel Display Names

- **Channels:** `#channel-name` (from `conversations.info`)
- **DMs:** `@display-name` (resolve user ID via user cache)
- **Group DMs:** `@name1, @name2, ...` (resolve member IDs, first 3 + "...")
- Show mention count if > 0
- Sort by: channels with mentions first, then by message count descending

### Channel Name Resolution

`client.counts` only returns channel IDs. Display names are resolved by calling `conversations.info` per channel. The count is bounded by unread channels (typically <20) and uses the existing retry/delay logic. For DMs, the channel name is empty — resolve the other user's display name via `fetchMembers()` + user cache. For group DMs, resolve all member names.

---

## Output Format

```markdown
# Unreads — 42 messages from 5 channels

## #general

### 2026-02-13

**@Alice** — 10:30 AM
Has anyone reviewed the Q1 metrics deck?

**@Bob** — 10:45 AM
Working on it now, should have comments by EOD.

## #engineering

### 2026-02-13

**@Carol** — 9:15 AM
Deployed v2.3.1 to staging. Please smoke test.

> **Thread** (3 replies) — @Carol at 9:15 AM: "Deployed v2.3.1 to staging..."
>
> **@Dave** — 9:20 AM
> LGTM, tests passing.
>
> **@Eve** — 9:25 AM
> One flaky test on CI, not related. Ship it.

## @alice

### 2026-02-12

**@Alice** — 5:30 PM
Can you look at the PR when you get a chance?

### 2026-02-13

**@Alice** — 8:00 AM
Morning! Any update on that PR?
```

### Structure

- `# Unreads` document header with total count and channel count
- `## #channel-name` (h2) per channel section
- `### YYYY-MM-DD` (h3) date headers within each channel
- Existing author lines, thread formatting, reactions, files — all reused from current converter
- Date heading level shifts from h2 → h3 (since h2 is taken by channel headers)

---

## Frontmatter

New source category: `slack-unreads`

New default template (`unreads_default`):

```yaml
---
title: "Unreads"
source: slack-unreads
workspace: "{{workspace}}"
captured: "{{captured|date:\"YYYY-MM-DDTHH:mm:ssZ\"}}"
channel_count: {{channel_count}}
message_count: {{message_count}}
channels: {{channels|join:", "}}
tags:
  - slack
  - unreads
---
```

### Template Context Variables (new for unreads)

| Variable | Type | Description |
|----------|------|-------------|
| `channel_count` | number | Number of channels included in export |
| `channels` | string[] | Array of channel display names |
| `mention_count` | number | Total @mention count across all channels |
| `workspace` | string | Workspace name |
| `workspace_domain` | string | Workspace domain |
| `captured` | Date | Capture timestamp |
| `message_count` | number | Total messages across all channels |

---

## Message Protocol

### New Message Types

```typescript
// Popup → Service Worker: discover unread channels
interface GetUnreadCountsRequest {
  type: 'GET_UNREAD_COUNTS';
}

// Service Worker → Popup: unread channel list
interface UnreadCountsResponse {
  type: 'UNREAD_COUNTS_RESPONSE';
  success: boolean;
  channels?: UnreadChannelInfo[];
  error?: string;
  errorCategory?: 'auth' | 'transient' | 'permanent';
}

interface UnreadChannelInfo {
  id: string;
  name: string;           // resolved display name (#channel, @user, etc.)
  type: 'channel' | 'im' | 'mpim';
  messageCount: number;   // estimated or fetched via conversations.info
  mentionCount: number;
  lastRead: string;       // timestamp for oldest param
}

// Popup → Service Worker: export selected unreads
interface FetchUnreadsRequest {
  type: 'FETCH_UNREADS';
  channels: { id: string; lastRead: string }[];
  includeThreads: boolean;
  includeReactions: boolean;
  includeFiles: boolean;
  includeFrontmatter: boolean;
}

// Service Worker → Popup: completed unreads export
interface FetchUnreadsResponse {
  type: 'FETCH_UNREADS_RESPONSE';
  success: boolean;
  markdown?: string;
  messageCount?: number;
  channelCount?: number;
  error?: string;
  errorCategory?: 'auth' | 'transient' | 'permanent';
}
```

### Progress Phases

Extend existing `ProgressPhase` type:

- `discovering` — calling `client.counts`
- `fetching_channel` — fetching messages for a specific channel (include channel name)
- Existing phases reused per-channel: `resolving_users`, `fetching_threads`, `converting`

```typescript
interface UnreadsProgressMessage {
  type: 'PROGRESS';
  phase: 'discovering' | 'fetching_channel' | 'resolving_users'
       | 'fetching_threads' | 'converting';
  channelName?: string;       // current channel being fetched
  channelIndex?: number;      // 1-based index
  channelTotal?: number;      // total selected channels
  current?: number;           // messages fetched so far (within current channel)
  total?: number;             // total messages in current channel (if known)
}
```

Popup displays:

- `Discovering unread channels...` (during `client.counts`)
- `Channel 3 of 5 — #engineering (24 messages)` (during per-channel fetch)
- `Resolving users...` / `Converting...` (final phases)

---

## Implementation Phases

### Phase U.A — Detection + Discovery (U.1 + U.2)

**URL detection:**

- Extend `parseSlackUrl()` return type to discriminated union with `'channel' | 'unreads'`
- Content script: detect `/unreads` and store a mode flag in session storage
- Popup: read flag, switch to unreads UI mode

**API discovery:**

- New `fetchClientCounts()` in `src/background/slack-api.ts`
- New `ClientCountsResponse` type in `src/types/slack-api.ts`
- New `GET_UNREAD_COUNTS` / `UNREAD_COUNTS_RESPONSE` message types
- Service worker handler: call `fetchClientCounts()`, resolve channel names via `fetchChannelInfo()`, respond to popup

**Popup UI:**

- Third mode: show channel list with checkboxes after discovery
- Display channel names, message counts, mention counts
- No export yet — just display

### Phase U.B — Per-Channel Fetch + Multi-Channel Output (U.3 + U.4)

**Fetching:**

- New `exportUnreads()` orchestrator in `src/core/export-unreads.ts`
- Loops over selected channels, calls existing `fetchMessages()` with `oldest=lastRead`
- Resolves users across all channels (shared user cache)
- Reports per-channel progress

**Conversion:**

- Add `dateHeadingLevel` option to `convertMessages()` (default h2, unreads uses h3)
- Assemble multi-channel document: document header + per-channel sections
- Each section: `## #channel-name` + converted messages with h3 date headers

**Frontmatter:**

- New `slack-unreads` source category in `detectSourceCategory()`
- New `unreads_default` template in `DEFAULT_TEMPLATES`
- New `buildUnreadsTemplateContext()` in frontmatter module

**Popup:**

- Wire Copy/Download buttons to `FETCH_UNREADS` message
- Show multi-channel progress bar with channel-level detail

### Phase U.C — Thread Replies in Unreads (U.5) — Deferred

Thread expansion within unreads is deferred because each thread parent requires a `conversations.replies` call, which can explode API usage (e.g., 30 unread channels × 5 thread parents each = 150 extra calls). Can be added later as an opt-in toggle with a warning about API call volume.

### Phase U.D — Collapsed Conversations (U.6) — Not Needed

The API-only approach inherently handles this. `conversations.history` returns all messages regardless of the DOM collapse state in the unreads view. No implementation needed.

---

## New and Modified Files

| File | Phase | Change |
|------|-------|--------|
| `src/shared/url-parser.ts` | U.A | Extend return type, add `/unreads` pattern |
| `src/background/slack-api.ts` | U.A | Add `fetchClientCounts()` |
| `src/types/slack-api.ts` | U.A | Add `ClientCountsResponse`, `UnreadChannel` types |
| `src/types/messages.ts` | U.A | Add unreads message types, extend `ProgressPhase` |
| `src/background/index.ts` | U.A | Add `GET_UNREAD_COUNTS` and `FETCH_UNREADS` handlers |
| `src/content/index.ts` | U.A | Detect `/unreads` URL, store mode flag |
| `src/popup/popup.html` | U.A+B | Add unreads mode UI (channel list, progress) |
| `src/popup/popup.ts` | U.A+B | Three-way mode switch, channel list rendering, unreads export |
| `src/core/export-unreads.ts` | U.B | **New** — multi-channel export orchestrator |
| `src/background/markdown/converter.ts` | U.B | Add `dateHeadingLevel` option |
| `src/background/markdown/frontmatter.ts` | U.B | Add `buildUnreadsTemplateContext()` |
| `src/shared/default-templates.ts` | U.B | Add `unreads_default` template |
| `tests/export-unreads.test.ts` | U.B | **New** — multi-channel orchestrator tests |
| `tests/url-parser.test.ts` | U.A | **New** — URL parsing tests including `/unreads` |

---

## Open Questions

1. **Estimated message counts:** `client.counts` gives `last_read` and `latest` timestamps but not an actual unread count. Options:
   - Show just "has unreads" (no count) — fast but less informative
   - Call `conversations.info` per channel for `unread_count_display` — N extra API calls but accurate
   - **Recommendation:** Call `conversations.info` per channel during discovery. We already call it for the channel name, so we get `unread_count_display` for free from the same response.

2. **Userscript support:** Should unreads mode work in the userscript too? The URL detection and API calls are platform-agnostic, but the UI would need a new section in the floating panel. **Recommendation:** Extension-only in U.A/U.B, userscript support as a follow-up.

3. **Select all / deselect all:** Should the channel list have a "Select All" toggle? Probably yes for UX, but can be added as polish during U.B.

4. **Maximum channels:** Should we cap the number of unread channels shown? Large workspaces might have 50+ unread channels. **Recommendation:** Show all with a warning if >30 channels ("This will make many API calls and may take a while").

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `client.counts` API changes shape | Low | High | Single wrapper function, response validation, graceful error |
| `client.counts` gets rate-limited | Low | Medium | Retry with backoff (existing infrastructure) |
| Too many unread channels (>50) | Low | Medium | Warning message, user can deselect |
| API calls take too long | Medium | Medium | Per-channel progress, cancel button |
| Large channel backlogs (1000+ unreads) | Low | Medium | Pagination handles it; same as existing export |
| s2md uses undocumented API surface | Already true | — | `xoxc-` token is already undocumented; `client.counts` doesn't materially increase risk |
