import { describe, it, expect } from 'vitest';
import { convertMrkdwn, type MrkdwnContext } from '../src/background/markdown/mrkdwn';

const ctx: MrkdwnContext = {
  resolveUser: (id) => `User_${id}`,
  resolveChannel: (id) => `channel_${id}`,
};

describe('convertMrkdwn', () => {
  it('converts bold', () => {
    expect(convertMrkdwn('*bold*', ctx)).toBe('**bold**');
  });

  it('converts italic', () => {
    expect(convertMrkdwn('_italic_', ctx)).toBe('*italic*');
  });

  it('converts strikethrough', () => {
    expect(convertMrkdwn('~strike~', ctx)).toBe('~~strike~~');
  });

  it('preserves inline code', () => {
    expect(convertMrkdwn('`code`', ctx)).toBe('`code`');
  });

  it('converts user mentions', () => {
    expect(convertMrkdwn('<@U12345>', ctx)).toBe('@User_U12345');
  });

  it('converts channel mentions', () => {
    expect(convertMrkdwn('<#C12345|general>', ctx)).toBe('#general');
  });

  it('converts links with text', () => {
    expect(convertMrkdwn('<https://example.com|click here>', ctx)).toBe(
      '[click here](https://example.com)',
    );
  });

  it('converts bare links', () => {
    expect(convertMrkdwn('<https://example.com>', ctx)).toBe(
      '<https://example.com>',
    );
  });

  it('handles mixed formatting', () => {
    const input = 'Hello *world*, check <https://example.com|this> and <@U999>';
    const expected =
      'Hello **world**, check [this](https://example.com) and @User_U999';
    expect(convertMrkdwn(input, ctx)).toBe(expected);
  });

  it('does not convert formatting inside code blocks', () => {
    expect(convertMrkdwn('```*not bold*```', ctx)).toBe('```*not bold*```');
  });
});
