import type { SlackMessage } from '../../types/slack-api';
import type { ChannelInfo } from '../slack-api';
import type { MessageScope } from '../../types/messages';

/** Frontmatter context assembled during export */
export interface FrontmatterContext {
  channel: ChannelInfo;
  workspaceName: string;
  workspaceDomain: string;
  messages: SlackMessage[];
  messageCount: number;
  scope: MessageScope;
}

/**
 * Detect source category from channel metadata.
 * Returns a human-readable category string for the `source` frontmatter field.
 */
export function detectSourceCategory(channel: ChannelInfo): string {
  if (channel.is_im) return 'slack-dm';
  if (channel.is_mpim) return 'slack-group-dm';
  if (channel.is_group && !channel.is_mpim) return 'slack-private-channel';
  if (channel.is_private) return 'slack-private-channel';
  return 'slack-channel';
}

/**
 * Derive a friendlier channel_type value from channel metadata.
 */
export function deriveChannelType(channel: ChannelInfo): string {
  if (channel.is_im) return 'dm';
  if (channel.is_mpim) return 'group_dm';
  if (channel.is_group && !channel.is_mpim) return 'private_channel';
  if (channel.is_private) return 'private_channel';
  return 'public_channel';
}

/**
 * Build a source URL from workspace domain and channel ID.
 */
export function buildSourceUrl(workspaceDomain: string, channelId: string): string {
  return `https://${workspaceDomain}.slack.com/archives/${channelId}`;
}

/**
 * Compute the date range string from messages.
 * Returns "YYYY-MM-DD to YYYY-MM-DD" or empty string if no messages.
 */
export function computeDateRange(messages: SlackMessage[]): string {
  if (messages.length === 0) return '';
  const first = parseFloat(messages[0].ts) * 1000;
  const last = parseFloat(messages[messages.length - 1].ts) * 1000;
  const firstDate = new Date(first).toISOString().split('T')[0];
  const lastDate = new Date(last).toISOString().split('T')[0];
  if (firstDate === lastDate) return firstDate;
  return `${firstDate} to ${lastDate}`;
}

/**
 * Escape a value for YAML output. Wraps in double quotes if the value
 * contains characters that are special in YAML.
 */
export function yamlEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  const str = String(value);
  if (str === '') return '""';

  // Quote if the string contains YAML-special characters or could be
  // misinterpreted as a YAML type (true/false/null/number)
  const needsQuotes =
    /[:#\[\]{}&*!|>'"%@`,?]/.test(str) ||
    /^\s|\s$/.test(str) ||
    /^(true|false|null|yes|no|on|off)$/i.test(str) ||
    /^-?\d/.test(str);

  if (needsQuotes) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * Serialize a flat object into a YAML frontmatter block (with --- delimiters).
 * Supports string, number, boolean, and string[] values.
 * Null/undefined/empty-string values are omitted.
 */
export function serializeFrontmatter(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlEscape(item)}`);
      }
    } else {
      lines.push(`${key}: ${yamlEscape(value)}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Build the complete YAML frontmatter string for a Slack export
 * using the fixed default template (Phase A).
 */
export function buildSlackFrontmatter(ctx: FrontmatterContext): string {
  const sourceCategory = detectSourceCategory(ctx.channel);
  const channelType = deriveChannelType(ctx.channel);
  const sourceUrl = buildSourceUrl(ctx.workspaceDomain, ctx.channel.id);
  const dateRange = computeDateRange(ctx.messages);
  const captured = new Date().toISOString();

  const data: Record<string, unknown> = {
    title: `#${ctx.channel.name}`,
    source: sourceCategory,
    source_url: sourceUrl,
    workspace: ctx.workspaceName,
    channel: ctx.channel.name,
    channel_type: channelType,
    captured,
    date_range: dateRange,
    message_count: ctx.messageCount,
    tags: ['slack'],
  };

  return serializeFrontmatter(data);
}
