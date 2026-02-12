import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectSourceCategory,
  deriveChannelType,
  buildSourceUrl,
  computeDateRange,
  yamlEscape,
  serializeFrontmatter,
  buildSlackFrontmatter,
  type FrontmatterContext,
} from '../src/background/markdown/frontmatter';
import type { ChannelInfo } from '../src/background/slack-api';
import type { SlackMessage } from '../src/types/slack-api';

function makeChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    id: 'C024BE91L',
    name: 'general',
    is_channel: true,
    is_group: false,
    is_im: false,
    is_mpim: false,
    ...overrides,
  };
}

function makeMessage(ts: string): SlackMessage {
  return { type: 'message', ts, text: '' };
}

// --- detectSourceCategory ---

describe('detectSourceCategory', () => {
  it('returns slack-channel for public channels', () => {
    expect(detectSourceCategory(makeChannel())).toBe('slack-channel');
  });

  it('returns slack-private-channel for group (legacy private)', () => {
    expect(
      detectSourceCategory(makeChannel({ is_channel: false, is_group: true })),
    ).toBe('slack-private-channel');
  });

  it('returns slack-private-channel when is_private is true', () => {
    expect(
      detectSourceCategory(makeChannel({ is_private: true })),
    ).toBe('slack-private-channel');
  });

  it('returns slack-dm for direct messages', () => {
    expect(
      detectSourceCategory(
        makeChannel({ is_channel: false, is_im: true }),
      ),
    ).toBe('slack-dm');
  });

  it('returns slack-group-dm for multi-party IMs', () => {
    expect(
      detectSourceCategory(
        makeChannel({ is_channel: false, is_group: true, is_mpim: true }),
      ),
    ).toBe('slack-group-dm');
  });
});

// --- deriveChannelType ---

describe('deriveChannelType', () => {
  it('returns public_channel for public channels', () => {
    expect(deriveChannelType(makeChannel())).toBe('public_channel');
  });

  it('returns private_channel for private channels', () => {
    expect(
      deriveChannelType(makeChannel({ is_channel: false, is_group: true })),
    ).toBe('private_channel');
  });

  it('returns dm for direct messages', () => {
    expect(
      deriveChannelType(makeChannel({ is_channel: false, is_im: true })),
    ).toBe('dm');
  });

  it('returns group_dm for multi-party IMs', () => {
    expect(
      deriveChannelType(
        makeChannel({ is_channel: false, is_group: true, is_mpim: true }),
      ),
    ).toBe('group_dm');
  });
});

// --- buildSourceUrl ---

describe('buildSourceUrl', () => {
  it('builds correct Slack archive URL', () => {
    expect(buildSourceUrl('myworkspace', 'C024BE91L')).toBe(
      'https://myworkspace.slack.com/archives/C024BE91L',
    );
  });
});

// --- computeDateRange ---

describe('computeDateRange', () => {
  it('returns empty string for no messages', () => {
    expect(computeDateRange([])).toBe('');
  });

  it('returns single date when all messages are same day', () => {
    const msgs = [
      makeMessage('1707580500.000000'), // 2024-02-10
      makeMessage('1707580600.000000'), // 2024-02-10
    ];
    expect(computeDateRange(msgs)).toBe('2024-02-10');
  });

  it('returns date range for messages spanning multiple days', () => {
    const msgs = [
      makeMessage('1707580500.000000'), // 2024-02-10
      makeMessage('1707666900.000000'), // 2024-02-11
    ];
    expect(computeDateRange(msgs)).toBe('2024-02-10 to 2024-02-11');
  });
});

// --- yamlEscape ---

describe('yamlEscape', () => {
  it('returns plain string when no special chars', () => {
    expect(yamlEscape('hello')).toBe('hello');
  });

  it('quotes strings with colons', () => {
    expect(yamlEscape('key: value')).toBe('"key: value"');
  });

  it('quotes strings with hash signs', () => {
    expect(yamlEscape('#general')).toBe('"#general"');
  });

  it('quotes strings starting with digits', () => {
    expect(yamlEscape('123abc')).toBe('"123abc"');
  });

  it('quotes boolean-like strings', () => {
    expect(yamlEscape('true')).toBe('"true"');
    expect(yamlEscape('false')).toBe('"false"');
    expect(yamlEscape('null')).toBe('"null"');
  });

  it('returns empty quoted string for empty input', () => {
    expect(yamlEscape('')).toBe('""');
  });

  it('escapes double quotes within strings', () => {
    expect(yamlEscape('say "hello"')).toBe('"say \\"hello\\""');
  });

  it('returns number as string', () => {
    expect(yamlEscape(42)).toBe('42');
  });

  it('returns boolean as string', () => {
    expect(yamlEscape(true)).toBe('true');
  });

  it('returns empty string for null/undefined', () => {
    expect(yamlEscape(null)).toBe('');
    expect(yamlEscape(undefined)).toBe('');
  });

  it('quotes strings with leading whitespace', () => {
    expect(yamlEscape(' hello')).toBe('" hello"');
  });

  it('quotes strings with trailing whitespace', () => {
    expect(yamlEscape('hello ')).toBe('"hello "');
  });
});

// --- serializeFrontmatter ---

describe('serializeFrontmatter', () => {
  it('produces valid YAML frontmatter block', () => {
    const result = serializeFrontmatter({
      title: '#general',
      source: 'slack-channel',
      message_count: 42,
    });
    expect(result).toBe(
      '---\ntitle: "#general"\nsource: slack-channel\nmessage_count: 42\n---',
    );
  });

  it('handles array values as YAML lists', () => {
    const result = serializeFrontmatter({
      tags: ['slack', 'export'],
    });
    expect(result).toBe('---\ntags:\n  - slack\n  - export\n---');
  });

  it('omits null/undefined/empty string values', () => {
    const result = serializeFrontmatter({
      title: 'test',
      author: null,
      description: undefined,
      notes: '',
    });
    expect(result).toBe('---\ntitle: test\n---');
  });

  it('omits empty arrays', () => {
    const result = serializeFrontmatter({
      title: 'test',
      tags: [],
    });
    expect(result).toBe('---\ntitle: test\n---');
  });

  it('handles boolean values', () => {
    const result = serializeFrontmatter({ archived: false });
    expect(result).toBe('---\narchived: false\n---');
  });
});

// --- buildSlackFrontmatter ---

describe('buildSlackFrontmatter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-12T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds complete frontmatter for a public channel', () => {
    const ctx: FrontmatterContext = {
      channel: makeChannel(),
      workspaceName: 'My Workspace',
      workspaceDomain: 'myworkspace',
      messages: [
        makeMessage('1707580500.000000'), // 2024-02-10
        makeMessage('1707666900.000000'), // 2024-02-11
      ],
      messageCount: 2,
      scope: { mode: 'last_n', count: 50 },
    };

    const result = buildSlackFrontmatter(ctx);

    expect(result).toContain('---');
    expect(result).toContain('title: "#general"');
    expect(result).toContain('source: slack-channel');
    expect(result).toContain(
      'source_url: "https://myworkspace.slack.com/archives/C024BE91L"',
    );
    expect(result).toContain('workspace: My Workspace');
    expect(result).toContain('channel: general');
    expect(result).toContain('channel_type: public_channel');
    expect(result).toContain('captured: "2026-02-12T14:30:00.000Z"');
    expect(result).toContain('date_range: "2024-02-10 to 2024-02-11"');
    expect(result).toContain('message_count: 2');
    expect(result).toContain('  - slack');
  });

  it('detects slack-dm source for DM channels', () => {
    const ctx: FrontmatterContext = {
      channel: makeChannel({ is_channel: false, is_im: true }),
      workspaceName: 'Test',
      workspaceDomain: 'test',
      messages: [],
      messageCount: 0,
      scope: { mode: 'all' },
    };

    const result = buildSlackFrontmatter(ctx);
    expect(result).toContain('source: slack-dm');
    expect(result).toContain('channel_type: dm');
  });

  it('detects slack-group-dm source for MPIMs', () => {
    const ctx: FrontmatterContext = {
      channel: makeChannel({
        is_channel: false,
        is_group: true,
        is_mpim: true,
      }),
      workspaceName: 'Test',
      workspaceDomain: 'test',
      messages: [],
      messageCount: 0,
      scope: { mode: 'all' },
    };

    const result = buildSlackFrontmatter(ctx);
    expect(result).toContain('source: slack-group-dm');
    expect(result).toContain('channel_type: group_dm');
  });

  it('omits date_range when no messages', () => {
    const ctx: FrontmatterContext = {
      channel: makeChannel(),
      workspaceName: 'Test',
      workspaceDomain: 'test',
      messages: [],
      messageCount: 0,
      scope: { mode: 'all' },
    };

    const result = buildSlackFrontmatter(ctx);
    expect(result).not.toContain('date_range');
  });
});
