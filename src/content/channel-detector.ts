import { STORAGE_KEYS } from '../shared/constants';

export interface ChannelInfo {
  workspaceId: string;
  channelId: string;
}

export function detectChannel(): ChannelInfo | null {
  // URL format: https://app.slack.com/client/{workspaceId}/{channelId}
  const match = window.location.pathname.match(
    /\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i,
  );
  if (!match) return null;
  return { workspaceId: match[1], channelId: match[2] };
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
