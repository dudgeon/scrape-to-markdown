import { clipPage } from '../core/clip-page';
import type { ClipPageOffscreenRequest } from '../types/messages';

/**
 * Offscreen document for DOM-dependent operations.
 * The service worker doesn't have DOMParser, so it delegates
 * clipPage() calls here via chrome.runtime.sendMessage.
 */
chrome.runtime.onMessage.addListener(
  (message: ClipPageOffscreenRequest, _sender, sendResponse) => {
    if (message.type !== 'CLIP_PAGE_OFFSCREEN') return;

    try {
      const result = clipPage(message.pageData);
      sendResponse({ success: true, ...result });
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return true; // async response
  },
);
