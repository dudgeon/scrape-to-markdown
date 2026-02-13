# Installing s2md as a Tampermonkey Userscript

If you can't load unpacked Chrome extensions (managed browsers, corporate policies, etc.), you can run s2md as a Tampermonkey userscript instead. Same features, same output — it just runs inside the page rather than as a browser extension.

## Prerequisites

- A Chromium-based browser (Chrome, Edge, Brave, Arc, etc.) or Firefox
- [Tampermonkey](https://www.tampermonkey.net/) browser extension installed

## Step 1: Install Tampermonkey

1. Go to [tampermonkey.net](https://www.tampermonkey.net/)
2. Click the install link for your browser — this takes you to the Chrome Web Store (or equivalent)
3. Click **Add to Chrome** (or your browser's equivalent)
4. Confirm the install when prompted

You should see the Tampermonkey icon (a black square with two circles) in your browser toolbar.

## Step 2: Install the s2md Userscript

**Option A — One-click install from GitHub (recommended)**

1. Open this URL in your browser:
   ```
   https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js
   ```
2. Tampermonkey auto-detects `.user.js` URLs and shows an install prompt
3. Review the script metadata (name, permissions, matched sites)
4. Click **Install**

**Option B — Manual install**

1. Click the Tampermonkey icon in your toolbar
2. Select **Create a new script...**
3. Delete the template code in the editor
4. Copy the entire contents of [`s2md.user.js`](https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js) and paste it in
5. Press **Ctrl+S** (or **Cmd+S** on Mac) to save

## Step 3: Use It

1. Navigate to any Slack channel at **app.slack.com**
2. Look for the blue **md** button in the bottom-right corner of the page
3. Click it to open the s2md panel
4. Choose your export scope, toggle options (threads, reactions, files, frontmatter), then click **Copy Markdown** or **Download .md**

The panel auto-detects which channel you're viewing and updates when you navigate to a different one.

## Updating

If you installed via the GitHub URL (Option A), Tampermonkey checks for updates automatically. You can also force an update:

1. Click the Tampermonkey icon → **Dashboard**
2. Find **scrape-to-markdown (s2md)** in the list
3. Click the script name to open the editor
4. Go to the **Settings** tab (within the editor)
5. Under **Updates**, click **Check for updates**

If you installed manually (Option B), repeat the manual install steps with the latest version of the file.

## Building from Source

If you want to build the userscript yourself (e.g., to test local changes):

```bash
npm install
npm run build:userscript
```

This outputs `s2md.user.js` in the repo root. Open it in your browser and Tampermonkey will offer to install it.

## Differences from the Chrome Extension

| | Chrome Extension | Tampermonkey Userscript |
|---|---|---|
| **Install method** | Load unpacked or Chrome Web Store | Tampermonkey install from URL |
| **UI location** | Browser toolbar popup | Floating panel on the Slack page |
| **Settings page** | Dedicated options page (gear icon) | Not yet available — uses default frontmatter template |
| **Token capture** | Passive via `chrome.webRequest` | Reads `window.boot_data` on page load |
| **Storage** | `chrome.storage.local` + `chrome.storage.session` | `GM_getValue` / `GM_setValue` (persistent) |
| **HTTP requests** | Standard `fetch()` | `GM_xmlhttpRequest` (bypasses CORS) |
| **Markdown output** | Identical | Identical |

The markdown conversion pipeline, thread formatting, frontmatter generation, and all export features are shared code — output is identical regardless of which distribution you use.

## Troubleshooting

**The blue "md" button doesn't appear**
- Make sure Tampermonkey is enabled (click its icon — the toggle should be on)
- Check that the script is enabled: Tampermonkey icon → Dashboard → ensure the toggle next to s2md is on
- Verify you're on `app.slack.com`, not a different Slack domain

**"Navigate to a Slack channel to begin"**
- The script reads the channel ID from the URL. Make sure you're inside a channel, DM, or group DM — not on the home screen or search page

**Export fails or hangs**
- Slack's API requires authentication. The userscript reads the token from `window.boot_data` on the page. If Slack has changed how they expose this, the script may need updating
- Check the browser console (F12 → Console) for error messages

**Tampermonkey doesn't show the install prompt**
- Make sure the URL ends in `.user.js` — Tampermonkey only auto-detects this suffix
- Try Option B (manual install) instead
