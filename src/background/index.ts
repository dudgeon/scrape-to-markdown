import type {
  ExtensionMessage,
  FetchMessagesRequest,
  FetchMessagesResponse,
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

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // indicates async response
  },
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATUS':
      return handleGetStatus();
    case 'FETCH_MESSAGES':
      return handleFetchMessages(message);
    default:
      return { error: 'Unknown message type' };
  }
}

async function handleGetStatus(): Promise<StatusResponse> {
  const data = await chrome.storage.session.get([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.CHANNEL_ID,
  ]);

  const hasToken = !!data[STORAGE_KEYS.TOKEN];
  const channelId = (data[STORAGE_KEYS.CHANNEL_ID] as string | undefined) || undefined;

  let channelName: string | undefined;
  if (hasToken && channelId) {
    try {
      const info = await fetchChannelInfo(channelId as string);
      channelName = info.name;
    } catch {
      // Channel info fetch failed, ok
    }
  }

  return { type: 'STATUS_RESPONSE', hasToken, channelId: channelId as string | undefined, channelName };
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
