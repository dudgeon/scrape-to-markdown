import type {
  ConversationsHistoryResponse,
  ConversationsInfoResponse,
  ConversationsRepliesResponse,
  UsersInfoResponse,
  SlackMessage,
} from '../types/slack-api';
import { SLACK_API_BASE, API_DELAY_MS, API_PAGE_LIMIT, STORAGE_KEYS } from '../shared/constants';

async function getAuth(): Promise<{ token: string; cookie: string }> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.TOKEN);
  const token = result[STORAGE_KEYS.TOKEN] as string | undefined;
  if (!token) throw new Error('No token available. Open Slack and refresh the page.');

  const cookie = await chrome.cookies.get({
    url: 'https://app.slack.com',
    name: 'd',
  });
  if (!cookie) throw new Error('No session cookie found. Make sure you are logged into Slack.');

  return { token, cookie: `d=${cookie.value}` };
}

async function slackApiCall<T>(method: string, params: Record<string, string>): Promise<T> {
  const { token, cookie } = await getAuth();

  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = (await response.json()) as T & { ok: boolean; error?: string };

  if (!data.ok) {
    if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
      await chrome.storage.session.remove(STORAGE_KEYS.TOKEN);
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchMessagesOptions {
  limit?: number;
  oldest?: string;
  latest?: string;
  onPage?: (pageNum: number) => void;
}

export async function fetchMessages(
  channelId: string,
  options: FetchMessagesOptions = {},
): Promise<SlackMessage[]> {
  const allMessages: SlackMessage[] = [];
  let cursor: string | undefined;
  const targetCount = options.limit;
  let fetched = 0;
  let pageNum = 0;

  do {
    const pageSize = targetCount
      ? Math.min(API_PAGE_LIMIT, targetCount - fetched)
      : API_PAGE_LIMIT;

    const params: Record<string, string> = {
      channel: channelId,
      limit: String(pageSize),
      inclusive: 'true',
    };
    if (options.oldest) params.oldest = options.oldest;
    if (options.latest) params.latest = options.latest;
    if (cursor) params.cursor = cursor;

    const resp = await slackApiCall<ConversationsHistoryResponse>(
      'conversations.history',
      params,
    );

    allMessages.push(...resp.messages);
    fetched += resp.messages.length;
    cursor = resp.response_metadata?.next_cursor || undefined;
    pageNum++;
    options.onPage?.(pageNum);

    if (targetCount && fetched >= targetCount) break;
    if (cursor) await delay(API_DELAY_MS);
  } while (cursor);

  // conversations.history returns newest-first; reverse to chronological
  allMessages.reverse();

  // Trim to exact count if needed (keep most recent)
  if (targetCount && allMessages.length > targetCount) {
    return allMessages.slice(allMessages.length - targetCount);
  }

  return allMessages;
}

export async function fetchThreadReplies(
  channelId: string,
  threadTs: string,
): Promise<SlackMessage[]> {
  const allMessages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      channel: channelId,
      ts: threadTs,
      limit: String(API_PAGE_LIMIT),
    };
    if (cursor) params.cursor = cursor;

    const resp = await slackApiCall<ConversationsRepliesResponse>(
      'conversations.replies',
      params,
    );

    allMessages.push(...resp.messages);
    cursor = resp.response_metadata?.next_cursor || undefined;

    if (cursor) await delay(API_DELAY_MS);
  } while (cursor);

  return allMessages;
}

export async function fetchChannelInfo(channelId: string): Promise<{ name: string }> {
  const resp = await slackApiCall<ConversationsInfoResponse>(
    'conversations.info',
    { channel: channelId },
  );
  return { name: resp.channel.name };
}

export async function fetchUserInfo(userId: string): Promise<{ displayName: string }> {
  const resp = await slackApiCall<UsersInfoResponse>(
    'users.info',
    { user: userId },
  );
  const profile = resp.user.profile;
  return {
    displayName: profile.display_name || profile.real_name || resp.user.real_name || userId,
  };
}
