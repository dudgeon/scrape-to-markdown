export const SLACK_API_BASE = 'https://slack.com/api';

export const STORAGE_KEYS = {
  TOKEN: 'slack_xoxc_token',
  CHANNEL_ID: 'current_channel_id',
  WORKSPACE_ID: 'current_workspace_id',
  USER_CACHE: 'user_display_name_cache',
  TEMPLATES: 'frontmatter_templates',
} as const;

export const API_DELAY_MS = 1000;
export const API_PAGE_LIMIT = 200;
export const DEFAULT_LAST_N = 50;
