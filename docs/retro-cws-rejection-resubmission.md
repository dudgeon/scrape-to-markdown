# Retro: CWS Rejection & Resubmission

**Date**: 2026-02-13
**Scope**: Chrome Web Store submission — first rejection (Purple Potassium) and resubmission

---

## What happened

The first CWS submission was rejected for the `activeTab` permission being requested but not used. The rejection was valid — the submitted build only had Slack functionality, where `activeTab` wasn't needed because explicit `content_scripts.matches` and `host_permissions` covered everything. The `activeTab` permission had been added during development anticipating web clipping, but the feature wasn't shipped in the submitted build.

## Root cause

**Permission was added before the feature that uses it was implemented.** The manifest requested `activeTab` for future web clipping work (Phase 4), but Phase 4 wasn't done when the extension was submitted to the CWS. CWS policy explicitly prohibits "future-proofing" permissions.

## What we fixed

1. **Shipped web clipping (Phase 4)** — `activeTab` is now actively used for:
   - `chrome.tabs.query()` to read the active tab URL (Slack vs. non-Slack detection)
   - `chrome.scripting.executeScript()` on arbitrary pages (web clipping data extraction)

2. **Updated manifest description** — changed from Slack-only to cover both modes: "Clip any web page or Slack conversation as clean markdown"

3. **Rewrote privacy policy** — the old policy only mentioned Slack and was missing:
   - `scripting` and `webRequest` permissions (not documented at all)
   - Web clipping data flow
   - `edgeapi.slack.com` host permission
   - Updated `activeTab` justification to reference web clipping

## Lessons to encode

1. **Never add a permission before the code that uses it ships.** CWS reviews against the submitted build, not your roadmap. If a permission is for a future feature, add it in the same PR/build that ships the feature.

2. **Keep the privacy policy in sync with the manifest.** Every permission and host_permission must have a row in the permissions table. Every data flow (Slack API calls, web page reading, cookie access) must be documented. Update the privacy policy whenever the manifest changes.

3. **Update the manifest description when the extension's scope changes.** The description is reviewed by CWS alongside the permissions — a Slack-only description with web-clipping permissions looks suspicious.

4. **CWS-facing docs are a checklist item for every manifest change.** When touching `src/manifest.json`, also update:
   - `docs/privacy-policy.md` (permissions table + data usage sections)
   - Manifest `description` field
   - CWS store listing description (in the Developer Dashboard, separate from the manifest)
