import { describe, it, expect } from 'vitest';
import { convertMessages, type ConverterOptions } from '../src/background/markdown/converter';
import type { SlackMessage } from '../src/types/slack-api';

const baseOptions: ConverterOptions = {
  channelName: 'general',
  userMap: {
    U001: 'Alice Johnson',
    U002: 'Bob Smith',
  },
};

function makeMessage(overrides: Partial<SlackMessage>): SlackMessage {
  return {
    type: 'message',
    ts: '1707580500.000000', // 2024-02-10 ~17:15 UTC
    text: '',
    ...overrides,
  };
}

describe('convertMessages', () => {
  it('produces document header with channel name and message count', () => {
    const result = convertMessages([], baseOptions);
    expect(result).toContain('# #general');
    expect(result).toContain('Messages: 0');
    expect(result).toContain('Exported from Slack');
  });

  it('groups messages by date', () => {
    const messages = [
      makeMessage({ ts: '1707580500.000000', user: 'U001', text: 'Hello' }),
      makeMessage({ ts: '1707666900.000000', user: 'U002', text: 'Hi' }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('## 2024-02-10');
    expect(result).toContain('## 2024-02-11');
  });

  it('renders author line with display name', () => {
    const messages = [
      makeMessage({ user: 'U001', text: 'Hello' }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('**Alice Johnson**');
  });

  it('falls back to user ID when not in userMap', () => {
    const messages = [
      makeMessage({ user: 'UUNKNOWN', text: 'Hello' }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('**UUNKNOWN**');
  });

  it('uses bot username for bot messages', () => {
    const messages = [
      makeMessage({ username: 'TestBot', text: 'Bot says hello' }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('**TestBot**');
  });

  it('renders system messages as italicized', () => {
    const messages = [
      makeMessage({
        subtype: 'channel_join',
        user: 'U001',
        text: '<@U001> has joined the channel',
      }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('*@Alice Johnson has joined the channel*');
  });

  it('converts rich_text blocks when present', () => {
    const messages = [
      makeMessage({
        user: 'U001',
        text: 'fallback',
        blocks: [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: 'Hello ', style: undefined },
                  { type: 'text', text: 'world', style: { bold: true } },
                ],
              },
            ],
          },
        ],
      }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('Hello **world**');
    expect(result).not.toContain('fallback');
  });

  it('falls back to mrkdwn when blocks are absent', () => {
    const messages = [
      makeMessage({ user: 'U001', text: '*bold text*' }),
    ];
    const result = convertMessages(messages, baseOptions);
    expect(result).toContain('**bold text**');
  });

  it('includes reactions when enabled', () => {
    const messages = [
      makeMessage({
        user: 'U001',
        text: 'Nice!',
        reactions: [
          { name: 'thumbsup', count: 3, users: [] },
          { name: 'heart', count: 1, users: [] },
        ],
      }),
    ];
    const result = convertMessages(messages, {
      ...baseOptions,
      includeReactions: true,
    });
    expect(result).toContain(':thumbsup: 3');
    expect(result).toContain(':heart: 1');
  });

  it('excludes reactions when disabled', () => {
    const messages = [
      makeMessage({
        user: 'U001',
        text: 'Nice!',
        reactions: [{ name: 'thumbsup', count: 3, users: [] }],
      }),
    ];
    const result = convertMessages(messages, {
      ...baseOptions,
      includeReactions: false,
    });
    expect(result).not.toContain(':thumbsup:');
  });

  it('includes file references when enabled', () => {
    const messages = [
      makeMessage({
        user: 'U001',
        text: 'See attached',
        files: [
          {
            id: 'F001',
            name: 'report.pdf',
            title: 'Report',
            mimetype: 'application/pdf',
            permalink: 'https://files.slack.com/report.pdf',
          },
        ],
      }),
    ];
    const result = convertMessages(messages, {
      ...baseOptions,
      includeFiles: true,
    });
    expect(result).toContain('[report.pdf](https://files.slack.com/report.pdf)');
  });

  it('renders thread block with header and grouped replies', () => {
    const parentTs = '1707580500.000000';
    const messages = [
      makeMessage({
        ts: parentTs,
        thread_ts: parentTs,
        user: 'U001',
        text: 'Thread parent',
        reply_count: 1,
      }),
    ];
    const threadReplies = {
      [parentTs]: [
        makeMessage({ ts: parentTs, user: 'U001', text: 'Thread parent' }),
        makeMessage({
          ts: '1707580600.000000',
          thread_ts: parentTs,
          user: 'U002',
          text: 'Thread reply',
        }),
      ],
    };
    const result = convertMessages(messages, {
      ...baseOptions,
      includeThreadReplies: true,
      threadReplies,
    });
    // Thread header with reply count and parent quote
    expect(result).toContain('**Thread** (1 reply to Alice Johnson');
    expect(result).toContain('\u201cThread parent\u201d');
    // Reply author inside blockquote (no "(thread reply)" label)
    expect(result).toContain('> **Bob Smith**');
    expect(result).toContain('> Thread reply');
    expect(result).not.toContain('(thread reply)');
  });

  it('thread header truncates long parent messages', () => {
    const parentTs = '1707580500.000000';
    const longText = 'A'.repeat(100);
    const messages = [
      makeMessage({
        ts: parentTs,
        thread_ts: parentTs,
        user: 'U001',
        text: longText,
        reply_count: 1,
      }),
    ];
    const threadReplies = {
      [parentTs]: [
        makeMessage({ ts: parentTs, user: 'U001', text: longText }),
        makeMessage({
          ts: '1707580600.000000',
          thread_ts: parentTs,
          user: 'U002',
          text: 'Reply',
        }),
      ],
    };
    const result = convertMessages(messages, {
      ...baseOptions,
      includeThreadReplies: true,
      threadReplies,
    });
    // Thread header should truncate at 80 chars with ellipsis
    const threadHeaderLine = result.split('\n').find((l) => l.includes('**Thread**'))!;
    expect(threadHeaderLine).toContain('A'.repeat(80) + '\u2026');
    expect(threadHeaderLine).not.toContain('A'.repeat(81));
  });

  it('thread header pluralizes reply count', () => {
    const parentTs = '1707580500.000000';
    const messages = [
      makeMessage({
        ts: parentTs,
        thread_ts: parentTs,
        user: 'U001',
        text: 'Parent',
        reply_count: 2,
      }),
    ];
    const threadReplies = {
      [parentTs]: [
        makeMessage({ ts: parentTs, user: 'U001', text: 'Parent' }),
        makeMessage({ ts: '1707580600.000000', thread_ts: parentTs, user: 'U002', text: 'Reply 1' }),
        makeMessage({ ts: '1707580700.000000', thread_ts: parentTs, user: 'U001', text: 'Reply 2' }),
      ],
    };
    const result = convertMessages(messages, {
      ...baseOptions,
      includeThreadReplies: true,
      threadReplies,
    });
    expect(result).toContain('2 replies to Alice Johnson');
    // Both replies present in the blockquote
    expect(result).toContain('> Reply 1');
    expect(result).toContain('> Reply 2');
  });

  it('omits document header when skipDocumentHeader is true', () => {
    const messages = [
      makeMessage({ user: 'U001', text: 'Hello' }),
    ];
    const result = convertMessages(messages, {
      ...baseOptions,
      skipDocumentHeader: true,
    });
    expect(result).not.toContain('# #general');
    expect(result).not.toContain('Exported from Slack');
    expect(result).toContain('**Alice Johnson**');
    expect(result).toContain('Hello');
  });

  it('includes document header by default', () => {
    const result = convertMessages([], baseOptions);
    expect(result).toContain('# #general');
    expect(result).toContain('Exported from Slack');
  });
});
