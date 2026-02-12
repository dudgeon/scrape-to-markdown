import type { SlackMessage, RichTextBlock } from '../../types/slack-api';
import { convertRichTextBlock, type ConversionContext } from './rich-text';
import { convertMrkdwn, type MrkdwnContext } from './mrkdwn';
import {
  formatTimestamp,
  formatAuthorLine,
  formatReactions,
  formatFile,
  formatSystemMessage,
  formatDocumentHeader,
} from './formatters';

const SYSTEM_SUBTYPES = new Set([
  'channel_join',
  'channel_leave',
  'channel_topic',
  'channel_purpose',
  'channel_name',
  'channel_archive',
]);

export interface ConverterOptions {
  channelName: string;
  userMap: Record<string, string>;
  channelMap?: Record<string, string>;
  includeReactions?: boolean;
  includeFiles?: boolean;
  includeThreadReplies?: boolean;
  threadReplies?: Record<string, SlackMessage[]>;
}

export function convertMessages(
  messages: SlackMessage[],
  options: ConverterOptions,
): string {
  const resolveUser = (userId: string) => options.userMap[userId] || userId;
  const resolveChannel = (channelId: string) =>
    options.channelMap?.[channelId] || channelId;

  const ctx: ConversionContext & MrkdwnContext = { resolveUser, resolveChannel };

  const sections: string[] = [];
  let currentDate = '';

  sections.push(formatDocumentHeader(options.channelName, messages.length));

  for (const msg of messages) {
    const { date, time } = formatTimestamp(msg.ts);

    // Date header
    if (date !== currentDate) {
      currentDate = date;
      sections.push(`## ${date}`);
    }

    // System messages
    if (msg.subtype && SYSTEM_SUBTYPES.has(msg.subtype)) {
      const text = convertMrkdwn(msg.text, ctx);
      sections.push(formatSystemMessage(text));
      continue;
    }

    // Author line
    const authorName = msg.user
      ? resolveUser(msg.user)
      : msg.username || 'Unknown';
    sections.push(formatAuthorLine(authorName, time));

    // Message body
    sections.push(convertMessageBody(msg, ctx));

    // Reactions
    if (options.includeReactions && msg.reactions?.length) {
      sections.push(formatReactions(msg.reactions));
    }

    // Files
    if (options.includeFiles && msg.files?.length) {
      for (const file of msg.files) {
        sections.push(formatFile(file));
      }
    }

    // Thread replies
    if (
      options.includeThreadReplies &&
      msg.thread_ts === msg.ts &&
      msg.reply_count &&
      msg.reply_count > 0
    ) {
      const replies = options.threadReplies?.[msg.ts];
      if (replies) {
        // Skip first element (it's the parent message)
        for (const reply of replies.slice(1)) {
          const { time: replyTime } = formatTimestamp(reply.ts);
          const replyAuthor = reply.user
            ? resolveUser(reply.user)
            : reply.username || 'Unknown';

          sections.push(formatAuthorLine(replyAuthor, replyTime, true));
          const replyBody = convertMessageBody(reply, ctx);
          sections.push(
            replyBody
              .split('\n')
              .map((line) => `> ${line}`)
              .join('\n'),
          );
        }
      }
    }
  }

  return sections.join('\n\n');
}

function convertMessageBody(
  msg: SlackMessage,
  ctx: ConversionContext & MrkdwnContext,
): string {
  const richTextBlock = msg.blocks?.find(
    (b): b is RichTextBlock => b.type === 'rich_text',
  );

  if (richTextBlock) {
    return convertRichTextBlock(richTextBlock, ctx);
  }

  return convertMrkdwn(msg.text, ctx);
}
