import { describe, it, expect } from 'vitest';
import { convertRichTextBlock, type ConversionContext } from '../src/background/markdown/rich-text';
import type { RichTextBlock } from '../src/types/slack-api';

const ctx: ConversionContext = {
  resolveUser: (id) => `User_${id}`,
  resolveChannel: (id) => `channel_${id}`,
};

function block(...elements: RichTextBlock['elements']): RichTextBlock {
  return { type: 'rich_text', elements };
}

describe('convertRichTextBlock', () => {
  it('converts plain text', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'Hello world' }],
      }),
      ctx,
    );
    expect(result).toBe('Hello world');
  });

  it('converts bold text', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'bold', style: { bold: true } }],
      }),
      ctx,
    );
    expect(result).toBe('**bold**');
  });

  it('converts italic text', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'italic', style: { italic: true } }],
      }),
      ctx,
    );
    expect(result).toBe('*italic*');
  });

  it('converts bold+italic text', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [
          { type: 'text', text: 'both', style: { bold: true, italic: true } },
        ],
      }),
      ctx,
    );
    expect(result).toBe('***both***');
  });

  it('converts strikethrough text', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'strike', style: { strike: true } }],
      }),
      ctx,
    );
    expect(result).toBe('~~strike~~');
  });

  it('converts inline code', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'code', style: { code: true } }],
      }),
      ctx,
    );
    expect(result).toBe('`code`');
  });

  it('code style takes precedence over bold/italic', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [
          {
            type: 'text',
            text: 'code',
            style: { code: true, bold: true, italic: true },
          },
        ],
      }),
      ctx,
    );
    expect(result).toBe('`code`');
  });

  it('converts links with text', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [
          { type: 'link', url: 'https://example.com', text: 'click here' },
        ],
      }),
      ctx,
    );
    expect(result).toBe('[click here](https://example.com)');
  });

  it('converts bare links', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'link', url: 'https://example.com' }],
      }),
      ctx,
    );
    expect(result).toBe('<https://example.com>');
  });

  it('converts emoji', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'emoji', name: 'wave' }],
      }),
      ctx,
    );
    expect(result).toBe(':wave:');
  });

  it('converts user mentions', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'user', user_id: 'U12345' }],
      }),
      ctx,
    );
    expect(result).toBe('@User_U12345');
  });

  it('converts channel mentions', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'channel', channel_id: 'C12345' }],
      }),
      ctx,
    );
    expect(result).toBe('#channel_C12345');
  });

  it('converts broadcast mentions', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [{ type: 'broadcast', range: 'here' }],
      }),
      ctx,
    );
    expect(result).toBe('@here');
  });

  it('converts bullet lists', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_list',
        style: 'bullet',
        indent: 0,
        elements: [
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'Item 1' }],
          },
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'Item 2' }],
          },
        ],
      }),
      ctx,
    );
    expect(result).toBe('- Item 1\n- Item 2');
  });

  it('converts ordered lists', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_list',
        style: 'ordered',
        indent: 0,
        elements: [
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'First' }],
          },
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'Second' }],
          },
        ],
      }),
      ctx,
    );
    expect(result).toBe('1. First\n2. Second');
  });

  it('converts indented lists', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_list',
        style: 'bullet',
        indent: 2,
        elements: [
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'Nested' }],
          },
        ],
      }),
      ctx,
    );
    expect(result).toBe('    - Nested');
  });

  it('converts code blocks', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_preformatted',
        elements: [{ type: 'text', text: 'const x = 1;' }],
      }),
      ctx,
    );
    expect(result).toBe('```\nconst x = 1;\n```');
  });

  it('converts blockquotes', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_quote',
        elements: [{ type: 'text', text: 'Someone said this' }],
      }),
      ctx,
    );
    expect(result).toBe('> Someone said this');
  });

  it('converts multiple sections separated by double newlines', () => {
    const result = convertRichTextBlock(
      block(
        {
          type: 'rich_text_section',
          elements: [{ type: 'text', text: 'Paragraph 1' }],
        },
        {
          type: 'rich_text_section',
          elements: [{ type: 'text', text: 'Paragraph 2' }],
        },
      ),
      ctx,
    );
    expect(result).toBe('Paragraph 1\n\nParagraph 2');
  });

  it('converts mixed inline elements', () => {
    const result = convertRichTextBlock(
      block({
        type: 'rich_text_section',
        elements: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world', style: { bold: true } },
          { type: 'text', text: '! ' },
          { type: 'emoji', name: 'wave' },
        ],
      }),
      ctx,
    );
    expect(result).toBe('Hello **world**! :wave:');
  });
});
