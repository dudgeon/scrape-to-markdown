import type {
  ExtensionMessage,
  FetchMessagesRequest,
  FetchMessagesResponse,
  StatusResponse,
  ProgressMessage,
} from '../types/messages';
import type { SlackMessage, RichTextBlock } from '../types/slack-api';
import { STORAGE_KEYS, API_DELAY_MS } from '../shared/constants';
import { fetchMessages, fetchChannelInfo, fetchThreadReplies, fetchTeamInfo, initSlackApi } from './slack-api';
import { resolveUsers, initUserCache } from './user-cache';
import { convertMessages } from './markdown/converter';
import { buildSlackFrontmatter, buildFrontmatterFromTemplate } from './markdown/frontmatter';
import type { FrontmatterContext } from './markdown/frontmatter';
import { getActiveTemplate, initTemplateStorage } from '../shared/template-storage';
import { ExtensionAuthProvider } from '../adapters/extension/auth';
import { ExtensionHttpClient } from '../adapters/extension/http';
import { ExtensionLocalStorage, ExtensionSyncStorage } from '../adapters/extension/storage';

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

function sendProgress(progress: Omit<ProgressMessage, 'type'>): void {
  chrome.runtime.sendMessage({ type: 'PROGRESS', ...progress }).catch(() => {
    // Popup may not be open
  });
}

async function handleFetchMessages(
  request: FetchMessagesRequest,
): Promise<FetchMessagesResponse> {
  try {
    // 1. Build fetch options from scope
    const options: { limit?: number; oldest?: string; latest?: string } = {};
    if (request.scope.mode === 'last_n') {
      options.limit = request.scope.count;
    } else if (request.scope.mode === 'date_range') {
      options.oldest = String(request.scope.oldest);
      options.latest = String(request.scope.latest);
    }

    // 2. Fetch messages
    sendProgress({ current: 0, phase: 'fetching' });
    const messages = await fetchMessages(request.channelId, {
      ...options,
      onPage: (pageNum) => sendProgress({ current: pageNum, phase: 'fetching' }),
    });

    // 3. Collect all unique user IDs
    sendProgress({ current: 0, phase: 'resolving_users' });
    const userIds = collectUserIds(messages);

    // 4. Resolve display names (batch, cached)
    const userMap = await resolveUsers(Array.from(userIds));

    // 5. Get channel name
    const channelInfo = await fetchChannelInfo(request.channelId);

    // 6. Fetch thread replies if requested
    let threadReplies: Record<string, SlackMessage[]> | undefined;
    if (request.includeThreads) {
      threadReplies = {};
      const threadParents = messages.filter(
        (m) => m.thread_ts === m.ts && m.reply_count && m.reply_count > 0,
      );

      sendProgress({ current: 0, total: threadParents.length, phase: 'fetching_threads' });
      for (let i = 0; i < threadParents.length; i++) {
        const parent = threadParents[i];
        const replies = await fetchThreadReplies(request.channelId, parent.ts);
        threadReplies[parent.ts] = replies;

        // Collect user IDs from thread replies too
        for (const reply of replies) {
          if (reply.user) userIds.add(reply.user);
        }

        sendProgress({
          current: i + 1,
          total: threadParents.length,
          phase: 'fetching_threads',
        });

        if (i < threadParents.length - 1) {
          await new Promise((r) => setTimeout(r, API_DELAY_MS));
        }
      }

      // Resolve any new user IDs from threads
      const allUserMap = await resolveUsers(Array.from(userIds));
      Object.assign(userMap, allUserMap);
    }

    // 7. Convert to markdown
    sendProgress({ current: 0, phase: 'converting' });
    const includeFrontmatter = request.includeFrontmatter ?? false;

    const markdown = convertMessages(messages, {
      channelName: channelInfo.name,
      userMap,
      includeReactions: request.includeReactions ?? false,
      includeFiles: request.includeFiles ?? false,
      includeThreadReplies: request.includeThreads ?? false,
      threadReplies,
      skipDocumentHeader: includeFrontmatter,
    });

    // 8. Prepend frontmatter if requested
    let finalMarkdown = markdown;
    if (includeFrontmatter) {
      let teamInfo = { name: '', domain: '' };
      try {
        teamInfo = await fetchTeamInfo();
      } catch {
        // team.info may fail for some workspaces; fall back to empty
      }

      const fmCtx: FrontmatterContext = {
        channel: channelInfo,
        workspaceName: teamInfo.name,
        workspaceDomain: teamInfo.domain,
        messages,
        messageCount: messages.length,
        scope: request.scope,
      };

      let frontmatter: string;
      try {
        const activeTemplate = await getActiveTemplate('slack');
        if (activeTemplate) {
          frontmatter = buildFrontmatterFromTemplate(activeTemplate, fmCtx);
        } else {
          frontmatter = buildSlackFrontmatter(fmCtx);
        }
      } catch {
        frontmatter = buildSlackFrontmatter(fmCtx);
      }

      finalMarkdown = frontmatter + '\n\n' + markdown;
    }

    return {
      type: 'FETCH_MESSAGES_RESPONSE',
      success: true,
      markdown: finalMarkdown,
      messageCount: messages.length,
    };
  } catch (err) {
    return {
      type: 'FETCH_MESSAGES_RESPONSE',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function collectUserIds(messages: SlackMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.user) ids.add(msg.user);
    if (msg.blocks) {
      for (const block of msg.blocks) {
        if (block.type === 'rich_text') {
          for (const el of (block as RichTextBlock).elements) {
            if ('elements' in el) {
              for (const inline of el.elements) {
                if (inline.type === 'user') ids.add(inline.user_id);
              }
            }
          }
        }
      }
    }
  }
  return ids;
}
