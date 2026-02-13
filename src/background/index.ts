import type {
  ExtensionMessage,
  FetchMessagesRequest,
  FetchMessagesResponse,
  GetStatusRequest,
  StatusResponse,
} from '../types/messages';
import { STORAGE_KEYS } from '../shared/constants';
import { fetchChannelInfo, initSlackApi } from './slack-api';
import { initUserCache } from './user-cache';
import { initTemplateStorage } from '../shared/template-storage';
import { ExtensionAuthProvider } from '../adapters/extension/auth';
import { ExtensionHttpClient } from '../adapters/extension/http';
import { ExtensionLocalStorage, ExtensionSyncStorage } from '../adapters/extension/storage';
import { exportSlackChannel } from '../core/export-slack';

// Initialize platform adapters
initSlackApi(new ExtensionAuthProvider(), new ExtensionHttpClient());
initUserCache(new ExtensionLocalStorage());
initTemplateStorage(new ExtensionSyncStorage());

// Allow content scripts to access session storage (MV3 restricts this by default)
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// --- Passive token capture via webRequest ---
// Captures the xoxc- token from Slack's own HTTP requests at the browser
// network layer. This avoids any dependency on page-world JS globals, which
// Slack client-v2 no longer exposes.

function storeToken(token: string): void {
  chrome.storage.session.set({ [STORAGE_KEYS.TOKEN]: token });
}

// Check Authorization header on Slack API requests
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details): undefined => {
    if (!details.requestHeaders) return;
    for (const header of details.requestHeaders) {
      if (
        header.name.toLowerCase() === 'authorization' &&
        header.value?.startsWith('Bearer xoxc-')
      ) {
        storeToken(header.value.slice('Bearer '.length));
        return;
      }
    }
  },
  { urls: ['https://slack.com/api/*', 'https://edgeapi.slack.com/*'] },
  ['requestHeaders'],
);

// Check POST body for token= field (Slack often sends it as form data)
chrome.webRequest.onBeforeRequest.addListener(
  (details): undefined => {
    // URL-encoded form data
    const formToken = details.requestBody?.formData?.['token']?.[0];
    if (typeof formToken === 'string' && formToken.startsWith('xoxc-')) {
      storeToken(formToken);
      return;
    }

    // JSON body fallback
    const raw = details.requestBody?.raw?.[0]?.bytes;
    if (raw) {
      try {
        const body = new TextDecoder().decode(raw);
        const parsed = JSON.parse(body);
        if (typeof parsed.token === 'string' && parsed.token.startsWith('xoxc-')) {
          storeToken(parsed.token);
        }
      } catch {
        // Not JSON — ignore
      }
    }
  },
  { urls: ['https://slack.com/api/*', 'https://edgeapi.slack.com/*'] },
  ['requestBody'],
);

// --- Message handling ---

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // indicates async response
  },
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'EXTRACT_TOKEN':
      // Token capture is handled passively by webRequest listeners above.
      // This message just ensures the service worker is awake.
      return;
    case 'CHANNEL_DETECTED':
      await chrome.storage.session.set({
        [STORAGE_KEYS.CHANNEL_ID]: message.channelId,
        [STORAGE_KEYS.WORKSPACE_ID]: message.workspaceId,
      });
      return;
    case 'GET_STATUS':
      return handleGetStatus(message);
    case 'FETCH_MESSAGES':
      return handleFetchMessages(message);
    default:
      return { error: 'Unknown message type' };
  }
}

async function handleGetStatus(request: GetStatusRequest): Promise<StatusResponse> {
  const data = await chrome.storage.session.get([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.CHANNEL_ID,
  ]);

  const hasToken = !!data[STORAGE_KEYS.TOKEN];

  // Prefer popup-provided IDs (derived from active tab) over global session storage
  const channelId = request.channelId
    || (data[STORAGE_KEYS.CHANNEL_ID] as string | undefined)
    || undefined;

  let channelName: string | undefined;
  if (hasToken && channelId) {
    try {
      const info = await fetchChannelInfo(channelId);
      channelName = info.name;
    } catch {
      // Channel info fetch failed, ok
    }
  }

  return { type: 'STATUS_RESPONSE', hasToken, channelId, channelName };
}

async function handleFetchMessages(
  request: FetchMessagesRequest,
): Promise<FetchMessagesResponse> {
  try {
    const result = await exportSlackChannel({
      channelId: request.channelId,
      scope: request.scope,
      includeThreads: request.includeThreads ?? false,
      includeReactions: request.includeReactions ?? false,
      includeFiles: request.includeFiles ?? false,
      includeFrontmatter: request.includeFrontmatter ?? false,
      onProgress: (progress) => {
        chrome.runtime.sendMessage({ type: 'PROGRESS', ...progress }).catch(() => {
          // Popup may not be open
        });
      },
    });

    return {
      type: 'FETCH_MESSAGES_RESPONSE',
      success: true,
      markdown: result.markdown,
      messageCount: result.messageCount,
    };
  } catch (err) {
    return {
      type: 'FETCH_MESSAGES_RESPONSE',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
