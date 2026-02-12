# Backlog: Configurable Clipboard Frontmatter

**Status**: Backlog (not yet scheduled)
**Depends on**: Phase 1 MVP of Slack Conversation Copier; pairs naturally with the web clipping feature
**Effort estimate**: Medium (template engine, settings UI, metadata extraction across both modes)

---

## Summary

Add configurable YAML frontmatter to all markdown output (Slack exports and web clips). Users can define which metadata fields appear, their order, and custom values. Ships with sensible defaults; power users can edit templates.

---

## Problem

The current spec outputs a simple header (`# #channel-name` + one-line summary). But users who feed clipped content into note-taking systems (Obsidian, Logseq, etc.) or LLM workflows need structured metadata: when it was captured, where it came from, what kind of source it is, who was involved. Without frontmatter, every clip requires manual annotation.

---

## YAML Frontmatter Standard

YAML frontmatter is the de facto standard for markdown metadata, supported by Obsidian, Hugo, Jekyll, GitHub, and dozens of other tools. It appears at the very top of a file:

```yaml
---
title: "#engineering"
source: slack
source_url: https://myworkspace.slack.com/archives/C024BE91L
workspace: My Workspace
channel: engineering
channel_type: public_channel
captured: 2026-02-12T14:30:00-05:00
date_range: 2026-01-15 to 2026-02-12
message_count: 156
participants:
  - Alice Smith
  - Bob Jones
tags:
  - slack
---
```

---

## Available Metadata by Source Type

### Slack Conversations

These fields can be extracted from existing Slack API calls (already planned in the MVP):

| Variable | Source | API Call | Notes |
|----------|--------|----------|-------|
| `{{channel}}` | Channel name | `conversations.info` → `name` | Without `#` prefix |
| `{{channel_id}}` | Channel ID | URL or `conversations.info` → `id` | e.g., `C024BE91L` |
| `{{channel_type}}` | Conversation type | `conversations.info` | Derived: `public_channel`, `private_channel`, `dm`, `group_dm` |
| `{{topic}}` | Channel topic | `conversations.info` → `topic.value` | May be empty |
| `{{purpose}}` | Channel purpose | `conversations.info` → `purpose.value` | May be empty |
| `{{workspace}}` | Workspace name | `team.info` → `team.name` | New API call |
| `{{workspace_domain}}` | Workspace domain | `team.info` → `team.domain` | e.g., `myworkspace` |
| `{{member_count}}` | Channel member count | `conversations.info` with `include_num_members=true` | Integer |
| `{{participants}}` | Member display names | `conversations.members` + `users.info` | Array; most useful for DMs/group DMs |
| `{{channel_created}}` | Channel creation date | `conversations.info` → `created` | Unix timestamp → formatted |
| `{{is_archived}}` | Archived status | `conversations.info` → `is_archived` | Boolean |
| `{{source_url}}` | Direct link | Constructed | `https://{domain}.slack.com/archives/{channel_id}` |
| `{{date_range}}` | Export date span | First/last message `ts` | e.g., `2026-01-15 to 2026-02-12` |
| `{{message_count}}` | Messages exported | Count during export | Integer |
| `{{captured}}` | Export timestamp | Local clock | ISO 8601 |
| `{{export_scope}}` | Scope used | User selection | e.g., `last_100`, `date_range`, `all` |

**New API call needed**: `team.info` (for workspace name/domain). This is a single call, cacheable for the session. Uses the same `xoxc-` token authentication.

**Participant list considerations**:
- For DMs (`is_im`): always 2 people — extract both via `conversations.members`
- For group DMs (`is_mpim`): list all participants — typically < 10 people
- For channels: `conversations.members` can return thousands of IDs; resolve only the first N or skip for large channels
- Participant names require `users.info` calls (already cached in the user name resolution system)

### Web Pages (Non-Slack)

These fields come from Readability.js output and HTML `<meta>` tags:

| Variable | Source | Notes |
|----------|--------|-------|
| `{{title}}` | Readability → `title` | Article title |
| `{{author}}` | Readability → `byline` | May be null |
| `{{site_name}}` | Readability → `siteName` | e.g., "The New York Times" |
| `{{description}}` | Readability → `excerpt` | First paragraph or meta description |
| `{{published}}` | Readability → `publishedTime` | ISO date string; may be null |
| `{{language}}` | Readability → `lang` | e.g., `en` |
| `{{source_url}}` | `window.location.href` | Full page URL |
| `{{domain}}` | `window.location.hostname` | e.g., `example.com` |
| `{{word_count}}` | Readability → `length` / ~5 | Approximate |
| `{{captured}}` | Local clock | ISO 8601 |
| `{{og:image}}` | `<meta property="og:image">` | Social share image URL |
| `{{meta:*}}` | Any `<meta>` tag | Wildcard access: `{{meta:keywords}}`, `{{meta:og:type}}`, etc. |

---

## Source Category

A key frontmatter field is `source` — a category tag identifying what kind of content was captured:

| Context | Auto-detected `source` value |
|---------|------------------------------|
| Slack public channel | `slack-channel` |
| Slack private channel | `slack-private-channel` |
| Slack DM | `slack-dm` |
| Slack group DM | `slack-group-dm` |
| Slack thread | `slack-thread` |
| Web article | `web-article` |
| Web page (non-article) | `web-page` |
| User selection | `web-selection` |

This is auto-detected but can be overridden in the template with a static value.

---

## Template System Design

### Syntax: `{{variable}}` with Pipe Filters

Following the pattern established by Obsidian Web Clipper (familiar to the target audience):

```
{{variable}}                    → raw value
{{variable|filter}}             → filtered value
{{variable|filter1|filter2}}    → chained filters
{{variable|date:"YYYY-MM-DD"}} → filter with argument
```

### Available Filters

| Filter | Example | Output |
|--------|---------|--------|
| `date` | `{{captured\|date:"YYYY-MM-DD"}}` | `2026-02-12` |
| `date` | `{{captured\|date:"YYYY-MM-DDTHH:mm:ssZ"}}` | `2026-02-12T14:30:00-05:00` |
| `lowercase` | `{{workspace\|lowercase}}` | `my workspace` |
| `uppercase` | `{{channel\|uppercase}}` | `ENGINEERING` |
| `default` | `{{author\|default:"Unknown"}}` | `Unknown` (if author is null) |
| `join` | `{{participants\|join:", "}}` | `Alice, Bob, Charlie` |
| `slug` | `{{title\|slug}}` | `my-article-title` |
| `trim` | `{{topic\|trim}}` | Strips leading/trailing whitespace |
| `truncate` | `{{description\|truncate:100}}` | First 100 chars + `…` |

Date formatting uses a subset of moment.js/dayjs tokens (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `Z`, `ddd`, `MMM`).

### Template Structure

Templates are stored as JSON in `chrome.storage.sync` (synced across devices):

```json
{
  "slack_default": {
    "name": "Slack Default",
    "enabled": true,
    "frontmatter": {
      "title": "{{channel}}",
      "source": "{{source_category}}",
      "source_url": "{{source_url}}",
      "workspace": "{{workspace}}",
      "channel": "{{channel}}",
      "channel_type": "{{channel_type}}",
      "captured": "{{captured|date:\"YYYY-MM-DDTHH:mm:ssZ\"}}",
      "date_range": "{{date_range}}",
      "message_count": "{{message_count}}",
      "tags": ["slack"]
    }
  },
  "slack_detailed": {
    "name": "Slack Detailed",
    "enabled": false,
    "frontmatter": {
      "title": "{{channel}}",
      "source": "{{source_category}}",
      "source_url": "{{source_url}}",
      "workspace": "{{workspace}}",
      "channel": "{{channel}}",
      "channel_type": "{{channel_type}}",
      "topic": "{{topic}}",
      "purpose": "{{purpose}}",
      "participants": "{{participants}}",
      "member_count": "{{member_count}}",
      "captured": "{{captured|date:\"YYYY-MM-DDTHH:mm:ssZ\"}}",
      "date_range": "{{date_range}}",
      "message_count": "{{message_count}}",
      "export_scope": "{{export_scope}}",
      "tags": ["slack", "{{workspace|lowercase|slug}}"]
    }
  },
  "web_default": {
    "name": "Web Clip Default",
    "enabled": true,
    "frontmatter": {
      "title": "{{title}}",
      "source": "{{source_category}}",
      "source_url": "{{source_url}}",
      "author": "{{author}}",
      "published": "{{published|date:\"YYYY-MM-DD\"}}",
      "captured": "{{captured|date:\"YYYY-MM-DDTHH:mm:ssZ\"}}",
      "tags": ["web-clip"]
    }
  }
}
```

### Template Selection Logic

1. If on `app.slack.com` → use the active `slack_*` template
2. If on any other page → use the active `web_*` template
3. User can switch templates in the popup dropdown
4. Only one template per category (`slack` / `web`) is active at a time

---

## Default Output Examples

### Slack Channel Export (Default Template)

```markdown
---
title: "#engineering"
source: slack-channel
source_url: https://myworkspace.slack.com/archives/C024BE91L
workspace: My Workspace
channel: engineering
channel_type: public_channel
captured: 2026-02-12T14:30:00-05:00
date_range: 2026-01-15 to 2026-02-12
message_count: 156
tags:
  - slack
---

## 2026-01-15

**Alice Johnson** — 9:15 AM

Here's the **updated proposal**...
```

### Slack Group DM Export (Detailed Template)

```markdown
---
title: "Group DM"
source: slack-group-dm
source_url: https://myworkspace.slack.com/archives/G024BE91L
workspace: My Workspace
channel: "mpdm-alice--bob--charlie-1"
channel_type: group_dm
participants:
  - Alice Smith
  - Bob Jones
  - Charlie Davis
captured: 2026-02-12T14:30:00-05:00
date_range: 2026-02-10 to 2026-02-12
message_count: 23
export_scope: all
tags:
  - slack
  - my-workspace
---

## 2026-02-10

**Alice Smith** — 3:22 PM

Hey, quick sync about the launch...
```

### Web Article Clip

```markdown
---
title: "How to Build a Chrome Extension in 2026"
source: web-article
source_url: https://example.com/blog/chrome-extension-guide
author: Jane Developer
published: 2026-01-28
captured: 2026-02-12T14:35:00-05:00
tags:
  - web-clip
---

# How to Build a Chrome Extension in 2026

Chrome extensions have evolved significantly...
```

---

## Settings UI

### Frontmatter Settings Page

Accessible from the popup (gear icon) or the extension's options page:

```
┌─────────────────────────────────────────────┐
│  Frontmatter Settings                       │
│                                             │
│  ☑ Include frontmatter in clipboard output  │
│  ☑ Include frontmatter in .md downloads     │
│                                             │
│  ── Slack Templates ──────────────────────  │
│  ● Slack Default                    [Edit]  │
│  ○ Slack Detailed                   [Edit]  │
│    [+ New Slack Template]                   │
│                                             │
│  ── Web Clip Templates ───────────────────  │
│  ● Web Clip Default                 [Edit]  │
│    [+ New Web Template]                     │
│                                             │
│  [Reset to Defaults]   [Export] [Import]    │
└─────────────────────────────────────────────┘
```

### Template Editor

Clicking [Edit] opens a template editor:

```
┌─────────────────────────────────────────────┐
│  Edit Template: Slack Default               │
│                                             │
│  Template Name: [Slack Default         ]    │
│                                             │
│  Frontmatter Fields:                        │
│  ┌──────────────┬────────────────────────┐  │
│  │ Key          │ Value                  │  │
│  ├──────────────┼────────────────────────┤  │
│  │ title        │ {{channel}}            │  │
│  │ source       │ {{source_category}}    │  │
│  │ source_url   │ {{source_url}}         │  │
│  │ captured     │ {{captured|date:"..."}}│  │
│  │ tags         │ ["slack"]              │  │
│  │ [+ Add field]                         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Available variables:                       │
│  {{channel}} {{channel_id}} {{channel_type}}│
│  {{workspace}} {{topic}} {{purpose}}        │
│  {{participants}} {{member_count}}          │
│  {{captured}} {{date_range}} ...            │
│                                             │
│  Preview:                                   │
│  ┌───────────────────────────────────────┐  │
│  │ ---                                   │  │
│  │ title: "#engineering"                 │  │
│  │ source: slack-channel                 │  │
│  │ captured: 2026-02-12T14:30:00-05:00   │  │
│  │ tags:                                 │  │
│  │   - slack                             │  │
│  │ ---                                   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Save]  [Cancel]  [Delete Template]        │
└─────────────────────────────────────────────┘
```

---

## Implementation Details

### YAML Serialization

Frontmatter is generated by simple key-value serialization — no need for a full YAML library:

```javascript
function serializeFrontmatter(data) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlEscape(item)}`);
      }
    } else {
      lines.push(`${key}: ${yamlEscape(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
```

Strings containing `:`, `#`, `[`, `]`, `{`, `}`, or leading/trailing whitespace must be quoted. A simple `yamlEscape()` function handles this — no need for a YAML library.

### Template Variable Resolution

```javascript
function resolveTemplate(template, context) {
  return template.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
    const [varName, ...filters] = expr.split('|').map(s => s.trim());
    let value = context[varName];
    for (const filter of filters) {
      value = applyFilter(value, filter);
    }
    return value ?? '';
  });
}
```

### Storage

- Templates stored in `chrome.storage.sync` (synced across user's Chrome instances)
- Max 100 KB total sync storage — more than enough for templates
- Export/import as JSON for backup and sharing

### Integration with Existing Output

The frontmatter prepends to the existing markdown output. The current spec's header format:

```markdown
# #channel-name

Exported from Slack · 2025-02-11 · Messages: 142
```

Changes to:

```markdown
---
title: "#channel-name"
source: slack-channel
captured: 2026-02-12T14:30:00-05:00
message_count: 142
...
---

## 2026-02-10

**Alice Johnson** — 9:15 AM
...
```

The inline header (`# #channel-name`, `Exported from Slack · ...`) becomes redundant when frontmatter is enabled. When frontmatter is disabled, the original inline header format is preserved.

---

## API Changes / New Calls

| API Call | Purpose | When Called | Caching |
|----------|---------|------------|---------|
| `team.info` | Workspace name + domain | Once per session | `chrome.storage.session` |
| `conversations.members` | Participant list for DMs/group DMs | When `{{participants}}` is in the active template AND conversation is DM/group DM | Cache per channel ID |
| `conversations.info` with `include_num_members=true` | Member count | When `{{member_count}}` is in the active template | Cache per channel ID |

**Optimization**: Only make API calls for variables that are actually referenced in the active template. Parse the template at export time, determine which variables are used, and skip API calls for unused variables.

---

## Implementation Phases (Within This Feature)

### Phase A: Core Frontmatter (MVP)

- YAML frontmatter generation from a fixed default template
- Toggle on/off in popup
- Slack variables: `channel`, `channel_type`, `source_url`, `captured`, `date_range`, `message_count`
- `team.info` API call for `workspace`

### Phase B: Template Editing

- Settings page with template editor UI
- Multiple templates per source type
- `{{variable|filter}}` processing
- Import/export templates as JSON
- Live preview in editor

### Phase C: Extended Metadata + Web

- `conversations.members` for participant lists (DMs/group DMs)
- All web clip variables (Readability output + meta tags)
- `{{meta:*}}` wildcard for arbitrary HTML meta tags
- Source category auto-detection
- Per-site template matching (URL patterns)

---

## Open Questions

1. **Should frontmatter be on by default?** Users who just want clean markdown for pasting into chat/LLMs may not want frontmatter. Recommend: **off by default for clipboard**, on by default for `.md` file downloads.

2. **Template sharing**: Should we support a community template gallery (like Obsidian Web Clipper)? This is a nice-to-have but adds significant scope. Defer to a later phase; import/export JSON covers the core need.

3. **Frontmatter-only mode**: Some users may want just the metadata (e.g., for updating a database/index) without the full message content. Worth supporting?

4. **Obsidian integration**: Obsidian Web Clipper uses a specific URI scheme to send clips directly into an Obsidian vault. Should we support this? It would make the extension a drop-in replacement for Obsidian Web Clipper for Slack content.

5. **Custom static fields**: Should users be able to add arbitrary static key/value pairs (e.g., `project: Q1 Launch`) that aren't derived from variables? Easy to support — just allow literal strings in the value field alongside `{{variable}}` expressions.

---

## References

- [Obsidian Web Clipper Templates](https://help.obsidian.md/web-clipper/templates) — Primary inspiration for template syntax
- [Obsidian Web Clipper Variables](https://help.obsidian.md/web-clipper/variables) — Variable system reference
- [Obsidian Web Clipper Filters](https://help.obsidian.md/web-clipper/filters) — Filter/pipe syntax reference
- [MarkDownload Template System](https://github.com/deathau/markdownload/blob/main/user-guide.md) — Simpler template approach
- [Jekyll Front Matter](https://jekyllrb.com/docs/front-matter/) — YAML frontmatter standard
- [Hugo Front Matter](https://gohugo.io/content-management/front-matter/) — Extended frontmatter fields
- [Obsidian Properties](https://help.obsidian.md/Editing+and+formatting/Properties) — How Obsidian consumes frontmatter
- [Slack conversations.info](https://docs.slack.dev/reference/methods/conversations.info/) — Channel metadata API
- [Slack conversations.members](https://docs.slack.dev/reference/methods/conversations.members/) — Member list API
- [Slack team.info](https://docs.slack.dev/reference/methods/team.info/) — Workspace metadata API
