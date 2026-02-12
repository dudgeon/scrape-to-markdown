export function formatTimestamp(ts: string): { date: string; time: string } {
  const unixMs = parseFloat(ts) * 1000;
  const d = new Date(unixMs);
  const date = d.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return { date, time };
}

export function formatAuthorLine(
  displayName: string,
  time: string,
): string {
  return `**${displayName}** \u2014 ${time}`;
}

const THREAD_QUOTE_MAX_LENGTH = 80;

export function formatThreadHeader(
  replyCount: number,
  parentAuthor: string,
  parentTime: string,
  parentBodyPreview: string,
): string {
  const truncated =
    parentBodyPreview.length > THREAD_QUOTE_MAX_LENGTH
      ? parentBodyPreview.slice(0, THREAD_QUOTE_MAX_LENGTH) + '\u2026'
      : parentBodyPreview;
  const noun = replyCount === 1 ? 'reply' : 'replies';
  return `> **Thread** (${replyCount} ${noun} to ${parentAuthor} \u2014 ${parentTime}: \u201c${truncated}\u201d):`;
}

export function formatReactions(reactions: { name: string; count: number }[]): string {
  if (!reactions.length) return '';
  const parts = reactions.map((r) => `:${r.name}: ${r.count}`);
  return `> ${parts.join(' \u00b7 ')}`;
}

export function formatFile(file: {
  name: string;
  url_private?: string;
  permalink?: string;
}): string {
  const url = file.permalink || file.url_private;
  if (url) {
    return `\ud83d\udcce [${file.name}](${url})`;
  }
  return `\ud83d\udcce ${file.name} (no public URL)`;
}

export function formatSystemMessage(text: string): string {
  return `*${text}*`;
}

export function formatDocumentHeader(channelName: string, messageCount: number): string {
  const today = new Date().toISOString().split('T')[0];
  return [
    `# #${channelName}`,
    '',
    `Exported from Slack \u00b7 ${today} \u00b7 Messages: ${messageCount}`,
    '',
    '---',
  ].join('\n');
}
