import type {
  ConversationsHistoryResponse,
  ConversationsInfoResponse,
  ConversationsRepliesResponse,
  TeamInfoResponse,
  UsersInfoResponse,
  SlackMessage,
} from '../types/slack-api';
import type { AuthProvider, HttpClient } from '../platform/interfaces';
import { SLACK_API_BASE, API_DELAY_MS, API_PAGE_LIMIT } from '../shared/constants';

let _auth: AuthProvider;
let _http: HttpClient;

export function initSlackApi(auth: AuthProvider, http: HttpClient): void {
  _auth = auth;
  _http = http;
}

async function slackApiCall<T>(method: string, params: Record<string, string>): Promise<T> {
  const token = await _auth.getToken();
  if (!token) throw new Error('No token available. Open Slack and refresh the page.');

  const cookie = await _auth.getCookie();
  if (!cookie) throw new Error('No session cookie found. Make sure you are logged into Slack.');

  const response = await _http.post(
    `${SLACK_API_BASE}/${method}`,
    {
      'Authorization': `Bearer ${token}`,
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    new URLSearchParams(params).toString(),
  );

  const data = (await response.json()) as T & { ok: boolean; error?: string };

  if (!data.ok) {
    if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
      await _auth.clearToken();
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

export interface ChannelInfo {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private?: boolean;
  topic?: string;
  purpose?: string;
}

export async function fetchChannelInfo(channelId: string): Promise<ChannelInfo> {
  const resp = await slackApiCall<ConversationsInfoResponse>(
    'conversations.info',
    { channel: channelId },
  );
  const ch = resp.channel;
  return {
    id: ch.id,
    name: ch.name,
    is_channel: ch.is_channel,
    is_group: ch.is_group,
    is_im: ch.is_im,
    is_mpim: ch.is_mpim,
    is_private: ch.is_private,
    topic: ch.topic?.value || '',
    purpose: ch.purpose?.value || '',
  };
}

export async function fetchTeamInfo(): Promise<{ name: string; domain: string }> {
  const resp = await slackApiCall<TeamInfoResponse>('team.info', {});
  return { name: resp.team.name, domain: resp.team.domain };
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
