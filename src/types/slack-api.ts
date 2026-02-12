// Slack API response envelope
export interface SlackApiResponse {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
}

// conversations.history
export interface ConversationsHistoryResponse extends SlackApiResponse {
  messages: SlackMessage[];
  has_more: boolean;
}

// conversations.replies
export interface ConversationsRepliesResponse extends SlackApiResponse {
  messages: SlackMessage[];
  has_more: boolean;
}

// conversations.info
export interface ConversationsInfoResponse extends SlackApiResponse {
  channel: {
    id: string;
    name: string;
    is_channel: boolean;
    is_group: boolean;
    is_im: boolean;
    is_mpim: boolean;
    topic?: { value: string };
    purpose?: { value: string };
  };
}

// users.info
export interface UsersInfoResponse extends SlackApiResponse {
  user: {
    id: string;
    real_name: string;
    profile: {
      display_name: string;
      real_name: string;
    };
    is_bot: boolean;
  };
}

// Message
export interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text: string;
  blocks?: RichTextBlock[];
  thread_ts?: string;
  reply_count?: number;
  reactions?: Reaction[];
  files?: SlackFile[];
  attachments?: SlackAttachment[];
}

export interface Reaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  url_private?: string;
  permalink?: string;
}

export interface SlackAttachment {
  fallback?: string;
  text?: string;
  pretext?: string;
  title?: string;
  title_link?: string;
  author_name?: string;
  from_url?: string;
}

// Rich text blocks
export interface RichTextBlock {
  type: 'rich_text';
  block_id?: string;
  elements: RichTextElement[];
}

export type RichTextElement =
  | RichTextSection
  | RichTextList
  | RichTextPreformatted
  | RichTextQuote;

export interface RichTextSection {
  type: 'rich_text_section';
  elements: InlineElement[];
}

export interface RichTextList {
  type: 'rich_text_list';
  style: 'bullet' | 'ordered';
  indent: number;
  elements: RichTextSection[];
}

export interface RichTextPreformatted {
  type: 'rich_text_preformatted';
  elements: InlineElement[];
  border?: number;
}

export interface RichTextQuote {
  type: 'rich_text_quote';
  elements: InlineElement[];
}

// Inline elements
export type InlineElement =
  | TextElement
  | LinkElement
  | EmojiElement
  | UserElement
  | ChannelElement
  | UsergroupElement
  | BroadcastElement;

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
}

export interface TextElement {
  type: 'text';
  text: string;
  style?: TextStyle;
}

export interface LinkElement {
  type: 'link';
  url: string;
  text?: string;
  style?: TextStyle;
}

export interface EmojiElement {
  type: 'emoji';
  name: string;
  unicode?: string;
}

export interface UserElement {
  type: 'user';
  user_id: string;
}

export interface ChannelElement {
  type: 'channel';
  channel_id: string;
}

export interface UsergroupElement {
  type: 'usergroup';
  usergroup_id: string;
}

export interface BroadcastElement {
  type: 'broadcast';
  range: string;
}
