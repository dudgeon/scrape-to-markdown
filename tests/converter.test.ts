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

  it('includes thread replies when enabled', () => {
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
    expect(result).toContain('(thread reply)');
    expect(result).toContain('**Bob Smith**');
    expect(result).toContain('> Thread reply');
  });
});
