import { STORAGE_KEYS } from '../shared/constants';
import { parseSlackUrl } from '../shared/url-parser';

export type { SlackIds as ChannelInfo } from '../shared/url-parser';

export function detectChannel() {
  return parseSlackUrl(window.location.href);
}

export function startChannelDetection(): void {
  let lastChannelId: string | null = null;

  function check() {
    const result = detectChannel();
    if (result && result.channelId !== lastChannelId) {
      lastChannelId = result.channelId;
      chrome.storage.session.set({
        [STORAGE_KEYS.CHANNEL_ID]: result.channelId,
        [STORAGE_KEYS.WORKSPACE_ID]: result.workspaceId,
      });
      chrome.runtime.sendMessage({
        type: 'CHANNEL_DETECTED',
        channelId: result.channelId,
        workspaceId: result.workspaceId,
      }).catch(() => {
        // Service worker may not be listening yet
      });
    }
  }

  // Check immediately and on interval (Slack uses pushState for SPA navigation)
  check();
  setInterval(check, 2000);
}
