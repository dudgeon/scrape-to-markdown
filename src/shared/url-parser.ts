/**
 * Parse Slack workspace and channel IDs from a URL.
 * Pure function — no browser API dependencies.
 */
export interface SlackIds {
  workspaceId: string;
  channelId: string;
}

/**
 * Returns workspace + channel IDs if the URL points to a Slack channel,
 * or null otherwise.
 */
export function parseSlackUrl(url: string): SlackIds | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== 'app.slack.com') return null;
    const match = pathname.match(/\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i);
    if (!match) return null;
    return { workspaceId: match[1], channelId: match[2] };
  } catch {
    return null;
  }
}

/** Returns true if the URL is on app.slack.com. */
export function isSlackUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'app.slack.com';
  } catch {
    return false;
  }
}
