# Backlog: Thread Formatting for LLM Readability

**Status**: Done
**Depends on**: Phase 2 (thread reply expansion — Done)
**Effort estimate**: Small (converter + formatters changes, test updates)

---

## Summary

Overhaul the markdown formatting of Slack thread replies so that parent→reply lineage is unambiguous, especially for LLM consumers that need to parse conversation chronology and threading structure.

---

## Problem

The current thread formatting uses blockquotes with a `(thread reply)` label on each reply's author line:

```markdown
**Alice Johnson** — 9:15 AM

Here's the updated proposal.

> **Bob Smith** — 9:22 AM (thread reply)
>
> Looks great! One question about the timeline.

> **Carol White** — 9:25 AM (thread reply)
>
> +1
```

Issues:
1. **Ambiguous parent linkage.** If Alice sends two messages at 9:15 AM, there's no way to tell which one the thread belongs to.
2. **No reply count.** The reader doesn't know upfront how many replies exist.
3. **`>` blockquotes clash with quoted content.** If a reply itself contains a blockquote, the nesting is visually indistinguishable.
4. **`(thread reply)` is redundant per-reply.** The reader already knows they're in a thread block — labeling each reply wastes tokens and adds noise.
5. **LLMs struggle to associate.** Without an explicit structural header linking replies back to the parent message, LLMs may misattribute reply content.

---

## Proposed Format

```markdown
**Alice Johnson** — 9:15 AM

Here's the updated proposal with the changes we discussed.

> **Thread** (2 replies to Alice Johnson — 9:15 AM: "Here's the updated proposal with the changes we dis…"):
>
> **Bob Smith** — 9:22 AM
> Looks great! One question about the timeline on page 3.
>
> **Carol White** — 9:25 AM
> +1
```

### Design decisions

| Decision | Rationale |
|----------|-----------|
| Thread header line with reply count | Tells the reader upfront how many replies to expect |
| Parent author + time in header | Links the thread back to a specific message |
| Truncated parent body preview (~80 chars) | Disambiguates when the same author sends multiple messages in the same minute |
| Single blockquote block for entire thread | Groups all replies visually; thread header acts as a section label |
| No per-reply `(thread reply)` label | Redundant once the thread header exists |
| Replies separated by blank `>` line | Keeps individual replies visually distinct within the block |

### Truncation rule

The parent body preview is taken from the plain-text rendering of the parent message, truncated to 80 characters with `…` appended if it exceeds that length. This keeps the thread header on a single readable line while providing enough context to disambiguate.

---

## Implementation

### Files changed

1. **`src/background/markdown/formatters.ts`**
   - Remove the `isThreadReply` parameter from `formatAuthorLine`
   - Add `formatThreadHeader(replyCount, parentAuthor, parentTime, parentBodyPreview)` function
   - Add `THREAD_QUOTE_MAX_LENGTH = 80` constant

2. **`src/background/markdown/converter.ts`**
   - Replace the thread reply rendering block (lines ~84-110) with:
     - Render thread header via `formatThreadHeader`
     - Render each reply as `> **Author** — Time` + `> body` (no `(thread reply)` suffix)
     - Pass the converted parent message body to `formatThreadHeader` for the preview

3. **`tests/converter.test.ts`**
   - Update existing thread test to match new format
   - Add test: thread header contains reply count
   - Add test: thread header contains truncated parent body preview
   - Add test: multiple replies in a single thread block

### No API changes

Thread data fetching is unchanged. This is purely a formatting change in the markdown output layer.

---

## Open Questions

None — this is a straightforward formatting change with no architectural implications.

---

## References

- Current thread implementation: `src/background/markdown/converter.ts` lines 84-110
- Current author line formatter: `src/background/markdown/formatters.ts` lines 13-22
- Existing thread tests: `tests/converter.test.ts` lines 167-197
