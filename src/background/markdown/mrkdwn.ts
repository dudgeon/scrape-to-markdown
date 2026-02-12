export type UserResolver = (userId: string) => string;
export type ChannelResolver = (channelId: string) => string;

export interface MrkdwnContext {
  resolveUser: UserResolver;
  resolveChannel: ChannelResolver;
}

export function convertMrkdwn(text: string, ctx: MrkdwnContext): string {
  let result = text;

  // User mentions: <@U12345> -> @DisplayName
  result = result.replace(/<@(U[A-Z0-9]+)>/g, (_, userId: string) => {
    return `@${ctx.resolveUser(userId)}`;
  });

  // Channel mentions: <#C12345|channel-name> -> #channel-name
  result = result.replace(/<#(C[A-Z0-9]+)\|([^>]+)>/g, (_, _channelId: string, name: string) => {
    return `#${name}`;
  });

  // Links with text: <URL|text> -> [text](URL)
  result = result.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');

  // Bare links: <URL> -> <URL>
  result = result.replace(/<(https?:\/\/[^>]+)>/g, '<$1>');

  // Bold: Slack *text* -> markdown **text**
  result = result.replace(/(?<![`\\])\*([^*\n]+)\*(?!`)/g, '**$1**');

  // Italic: Slack _text_ -> markdown *text*
  result = result.replace(/(?<![`\\])_([^_\n]+)_(?!`)/g, '*$1*');

  // Strikethrough: Slack ~text~ -> markdown ~~text~~
  result = result.replace(/(?<![`\\])~([^~\n]+)~(?!`)/g, '~~$1~~');

  // Code blocks and inline code are the same syntax — no conversion needed

  return result;
}
