// Content Script -> Service Worker
export interface TokenReadyMessage {
  type: 'TOKEN_READY';
  token: string;
}

export interface ExtractTokenMessage {
  type: 'EXTRACT_TOKEN';
}

export interface ChannelDetectedMessage {
  type: 'CHANNEL_DETECTED';
  channelId: string;
  workspaceId: string;
}

// Popup -> Service Worker
export interface FetchMessagesRequest {
  type: 'FETCH_MESSAGES';
  channelId: string;
  scope: MessageScope;
  includeThreads?: boolean;
  includeReactions?: boolean;
  includeFiles?: boolean;
  includeFrontmatter?: boolean;
}

export interface GetStatusRequest {
  type: 'GET_STATUS';
}

// Service Worker -> Popup (responses)
export interface FetchMessagesResponse {
  type: 'FETCH_MESSAGES_RESPONSE';
  success: boolean;
  markdown?: string;
  messageCount?: number;
  error?: string;
}

export interface StatusResponse {
  type: 'STATUS_RESPONSE';
  hasToken: boolean;
  channelId?: string;
  channelName?: string;
}

// Progress events (service worker -> popup)
export interface ProgressMessage {
  type: 'PROGRESS';
  current: number;
  total?: number;
  phase: 'fetching' | 'resolving_users' | 'converting' | 'fetching_threads';
}

// Scope types
export type MessageScope =
  | { mode: 'last_n'; count: number }
  | { mode: 'date_range'; oldest: number; latest: number }
  | { mode: 'all' };

// Union message type
export type ExtensionMessage =
  | TokenReadyMessage
  | ExtractTokenMessage
  | ChannelDetectedMessage
  | FetchMessagesRequest
  | GetStatusRequest
  | FetchMessagesResponse
  | StatusResponse
  | ProgressMessage;
