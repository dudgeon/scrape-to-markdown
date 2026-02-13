// Wakes the service worker so its webRequest listeners are active.
// The actual token capture happens passively via chrome.webRequest
// in the service worker — no page-world injection needed.

export function startTokenExtraction(): void {
  chrome.runtime.sendMessage({ type: 'EXTRACT_TOKEN' }).catch(() => {
    // Service worker may not be listening yet
  });
}
