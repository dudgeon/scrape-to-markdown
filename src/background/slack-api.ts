import type {
  ConversationsHistoryResponse,
  ConversationsInfoResponse,
  ConversationsMembersResponse,
  ConversationsRepliesResponse,
  TeamInfoResponse,
  UsersInfoResponse,
  SlackMessage,
} from '../types/slack-api';
import type { AuthProvider, HttpClient } from '../platform/interfaces';
import { SLACK_API_BASE, API_DELAY_MS, API_PAGE_LIMIT } from '../shared/constants';
import { withRetry } from './retry';

let _auth: AuthProvider;
let _http: HttpClient;

export function initSlackApi(auth: AuthProvider, http: HttpClient): void {
  _auth = auth;
  _http = http;
}

// --- Error classes ---

export class SlackApiError extends Error {
  constructor(
    message: string,
    public readonly slackError?: string,
  ) {
    super(message);
    this.name = 'SlackApiError';
  }
}

export class SlackAuthError extends SlackApiError {
  constructor(slackError: string) {
    super('Your Slack session has expired. Please refresh Slack and try again.', slackError);
    this.name = 'SlackAuthError';
  }
}

export class SlackTransientError extends SlackApiError {
  /** Retry-After delay in ms, if the server provided one */
  public readonly retryAfterMs?: number;

  constructor(message: string, slackError?: string, retryAfterMs?: number) {
    super(message, slackError);
    this.name = 'SlackTransientError';
    this.retryAfterMs = retryAfterMs;
  }
}

// --- Retry helpers ---

function isTransient(error: unknown): boolean {
  return error instanceof SlackTransientError;
}

function getRetryAfter(error: unknown): number | undefined {
  if (error instanceof SlackTransientError) return error.retryAfterMs;
  return undefined;
}

const RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  shouldRetry: isTransient,
  getRetryAfter,
};

// --- Core API call ---

async function slackApiCall<T>(method: string, params: Record<string, string>): Promise<T> {
  const token = await _auth.getToken();
  if (!token) throw new SlackApiError('No token available. Open Slack and refresh the page.');

  const cookie = await _auth.getCookie();
  if (!cookie) throw new SlackApiError('No session cookie found. Make sure you are logged into Slack.');

  let response;
  try {
    response = await _http.post(
      `${SLACK_API_BASE}/${method}`,
      {
        'Authorization': `Bearer ${token}`,
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      new URLSearchParams(params).toString(),
    );
  } catch (err) {
    // Network-level failure (fetch threw) — transient
    throw new SlackTransientError(
      `Network error calling ${method}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // HTTP 429 — rate limited
  if (response.status === 429) {
    const retryAfterSec = response.ok ? undefined : undefined; // response.ok is fetch-ok, not useful here
    // Try to parse Retry-After header — Slack returns seconds
    let retryAfterMs: number | undefined;
    try {
      const data = await response.json() as { retry_after?: number };
      if (data.retry_after) retryAfterMs = data.retry_after * 1000;
    } catch {
      // Can't parse body — use default backoff
    }
    throw new SlackTransientError(
      `Rate limited by Slack API (${method})`,
      'ratelimited',
      retryAfterMs ?? 5000,
    );
  }

  const data = (await response.json()) as T & { ok: boolean; error?: string };

  if (!data.ok) {
    if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
      await _auth.clearToken();
      throw new SlackAuthError(data.error);
    }
    // Some errors are transient on the Slack side
    if (data.error === 'internal_error' || data.error === 'fatal_error') {
      throw new SlackTransientError(`Slack API error: ${data.error}`, data.error);
    }
    throw new SlackApiError(`Slack API error: ${data.error}`, data.error);
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

    const resp = await withRetry(
      () => slackApiCall<ConversationsHistoryResponse>('conversations.history', params),
      RETRY_OPTIONS,
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

    const resp = await withRetry(
      () => slackApiCall<ConversationsRepliesResponse>('conversations.replies', params),
      RETRY_OPTIONS,
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
  const resp = await withRetry(
    () => slackApiCall<ConversationsInfoResponse>('conversations.info', { channel: channelId }),
    RETRY_OPTIONS,
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
  const resp = await withRetry(
    () => slackApiCall<TeamInfoResponse>('team.info', {}),
    RETRY_OPTIONS,
  );
  return { name: resp.team.name, domain: resp.team.domain };
}

export async function fetchUserInfo(userId: string): Promise<{ displayName: string }> {
  const resp = await withRetry(
    () => slackApiCall<UsersInfoResponse>('users.info', { user: userId }),
    RETRY_OPTIONS,
  );
  const profile = resp.user.profile;
  return {
    displayName: profile.display_name || profile.real_name || resp.user.real_name || userId,
  };
}

export async function fetchMembers(channelId: string): Promise<string[]> {
  const allMembers: string[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      channel: channelId,
      limit: String(API_PAGE_LIMIT),
    };
    if (cursor) params.cursor = cursor;

    const resp = await withRetry(
      () => slackApiCall<ConversationsMembersResponse>('conversations.members', params),
      RETRY_OPTIONS,
    );

    allMembers.push(...resp.members);
    cursor = resp.response_metadata?.next_cursor || undefined;

    if (cursor) await delay(API_DELAY_MS);
  } while (cursor);

  return allMembers;
}
