import type { SlackMessage, RichTextBlock } from '../../types/slack-api';
import { convertRichTextBlock, type ConversionContext } from './rich-text';
import { convertMrkdwn, type MrkdwnContext } from './mrkdwn';
import {
  formatTimestamp,
  formatAuthorLine,
  formatThreadHeader,
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
  /** When true, omits the document header (used when frontmatter is prepended instead). */
  skipDocumentHeader?: boolean;
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

  if (!options.skipDocumentHeader) {
    sections.push(formatDocumentHeader(options.channelName, messages.length));
  }

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

    // Thread replies — grouped blockquote with header
    if (
      options.includeThreadReplies &&
      msg.thread_ts === msg.ts &&
      msg.reply_count &&
      msg.reply_count > 0
    ) {
      const replies = options.threadReplies?.[msg.ts];
      if (replies && replies.length > 1) {
        const parentBody = convertMessageBody(msg, ctx);
        const replyCount = replies.length - 1; // exclude parent
        const threadLines: string[] = [];

        // Thread header with reply count + parent quote for disambiguation
        threadLines.push(
          formatThreadHeader(replyCount, authorName, time, parentBody),
        );

        // Each reply: author line + body, all blockquoted
        for (const reply of replies.slice(1)) {
          const { time: replyTime } = formatTimestamp(reply.ts);
          const replyAuthor = reply.user
            ? resolveUser(reply.user)
            : reply.username || 'Unknown';

          threadLines.push('>');
          threadLines.push(`> **${replyAuthor}** \u2014 ${replyTime}`);
          const replyBody = convertMessageBody(reply, ctx);
          for (const line of replyBody.split('\n')) {
            threadLines.push(`> ${line}`);
          }
        }

        sections.push(threadLines.join('\n'));
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
