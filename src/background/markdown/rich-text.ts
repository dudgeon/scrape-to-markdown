import type {
  RichTextBlock,
  RichTextElement,
  RichTextSection,
  RichTextList,
  RichTextPreformatted,
  RichTextQuote,
  InlineElement,
  TextStyle,
} from '../../types/slack-api';

export type UserResolver = (userId: string) => string;
export type ChannelResolver = (channelId: string) => string;

export interface ConversionContext {
  resolveUser: UserResolver;
  resolveChannel: ChannelResolver;
}

export function convertRichTextBlock(
  block: RichTextBlock,
  ctx: ConversionContext,
): string {
  return block.elements.map((el) => convertElement(el, ctx)).join('\n\n');
}

function convertElement(element: RichTextElement, ctx: ConversionContext): string {
  switch (element.type) {
    case 'rich_text_section':
      return convertSection(element, ctx);
    case 'rich_text_list':
      return convertList(element, ctx);
    case 'rich_text_preformatted':
      return convertPreformatted(element, ctx);
    case 'rich_text_quote':
      return convertQuote(element, ctx);
    default:
      return '';
  }
}

function convertSection(section: RichTextSection, ctx: ConversionContext): string {
  return section.elements.map((el) => convertInline(el, ctx)).join('');
}

function convertList(list: RichTextList, ctx: ConversionContext): string {
  const indent = '  '.repeat(list.indent || 0);
  return list.elements
    .map((item, index) => {
      const content = convertSection(item, ctx);
      const marker = list.style === 'ordered' ? `${index + 1}.` : '-';
      return `${indent}${marker} ${content}`;
    })
    .join('\n');
}

function convertPreformatted(pre: RichTextPreformatted, ctx: ConversionContext): string {
  const content = pre.elements.map((el) => convertInline(el, ctx)).join('');
  return '```\n' + content + '\n```';
}

function convertQuote(quote: RichTextQuote, ctx: ConversionContext): string {
  const content = quote.elements.map((el) => convertInline(el, ctx)).join('');
  return content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function convertInline(element: InlineElement, ctx: ConversionContext): string {
  switch (element.type) {
    case 'text':
      return applyStyles(element.text, element.style);
    case 'link': {
      const linkText = element.text
        ? `[${element.text}](${element.url})`
        : `<${element.url}>`;
      return element.style ? applyStyles(linkText, element.style) : linkText;
    }
    case 'emoji':
      return `:${element.name}:`;
    case 'user':
      return `@${ctx.resolveUser(element.user_id)}`;
    case 'channel':
      return `#${ctx.resolveChannel(element.channel_id)}`;
    case 'usergroup':
      return `@group`;
    case 'broadcast':
      return `@${element.range}`;
    default:
      return '';
  }
}

function applyStyles(text: string, style?: TextStyle): string {
  if (!style) return text;
  // Code takes precedence — no markdown nesting inside backticks
  if (style.code) return `\`${text}\``;

  let result = text;
  if (style.bold && style.italic) {
    result = `***${result}***`;
  } else if (style.bold) {
    result = `**${result}**`;
  } else if (style.italic) {
    result = `*${result}*`;
  }
  if (style.strike) {
    result = `~~${result}~~`;
  }
  return result;
}
