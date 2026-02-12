import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseExpression,
  applyFilter,
  formatDate,
  resolveTemplateValue,
  resolveTemplate,
  type TemplateFilter,
  type TemplateContext,
} from '../src/background/markdown/template-engine';

// --- parseExpression ---

describe('parseExpression', () => {
  it('parses a simple variable', () => {
    expect(parseExpression('channel')).toEqual({
      variable: 'channel',
      filters: [],
    });
  });

  it('parses variable with one filter', () => {
    expect(parseExpression('channel|lowercase')).toEqual({
      variable: 'channel',
      filters: [{ name: 'lowercase' }],
    });
  });

  it('parses variable with chained filters', () => {
    expect(parseExpression('workspace|lowercase|slug')).toEqual({
      variable: 'workspace',
      filters: [{ name: 'lowercase' }, { name: 'slug' }],
    });
  });

  it('parses filter with numeric argument', () => {
    expect(parseExpression('title|truncate:50')).toEqual({
      variable: 'title',
      filters: [{ name: 'truncate', arg: '50' }],
    });
  });

  it('parses filter with quoted argument', () => {
    expect(parseExpression('captured|date:"YYYY-MM-DD"')).toEqual({
      variable: 'captured',
      filters: [{ name: 'date', arg: 'YYYY-MM-DD' }],
    });
  });

  it('parses filter with complex quoted argument containing colons', () => {
    expect(parseExpression('captured|date:"YYYY-MM-DDTHH:mm:ssZ"')).toEqual({
      variable: 'captured',
      filters: [{ name: 'date', arg: 'YYYY-MM-DDTHH:mm:ssZ' }],
    });
  });

  it('parses filter with single-quoted argument', () => {
    expect(parseExpression("author|default:'Unknown'")).toEqual({
      variable: 'author',
      filters: [{ name: 'default', arg: 'Unknown' }],
    });
  });

  it('handles whitespace around pipes', () => {
    expect(parseExpression('  channel | lowercase | slug  ')).toEqual({
      variable: 'channel',
      filters: [{ name: 'lowercase' }, { name: 'slug' }],
    });
  });

  it('handles empty expression', () => {
    expect(parseExpression('')).toEqual({ variable: '', filters: [] });
  });
});

// --- formatDate ---

describe('formatDate', () => {
  // Use a fixed date: 2026-02-12T14:30:45 UTC
  const date = new Date('2026-02-12T14:30:45.000Z');

  it('formats YYYY', () => {
    expect(formatDate(date, 'YYYY')).toBe('2026');
  });

  it('formats MM (zero-padded month)', () => {
    expect(formatDate(date, 'MM')).toBe('02');
  });

  it('formats DD (zero-padded day)', () => {
    expect(formatDate(date, 'DD')).toBe('12');
  });

  it('formats full ISO-like date', () => {
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-02-12');
  });

  it('formats MMM (abbreviated month)', () => {
    expect(formatDate(date, 'MMM')).toBe('Feb');
  });

  it('formats ddd (abbreviated weekday)', () => {
    // 2026-02-12 is a Thursday
    expect(formatDate(date, 'ddd')).toBe('Thu');
  });

  it('formats combined date and time tokens', () => {
    // Use a UTC date and test in UTC context by checking HH/mm/ss match UTC values
    const utcDate = new Date(Date.UTC(2026, 1, 12, 14, 30, 45));
    const result = formatDate(utcDate, 'YYYY-MM-DD HH:mm:ss');
    // The result depends on the local timezone, so just check the date part
    expect(result).toMatch(/^2026-02-1\d \d{2}:\d{2}:\d{2}$/);
  });

  it('formats Z (timezone offset)', () => {
    const result = formatDate(date, 'Z');
    // Should match +HH:MM or -HH:MM pattern
    expect(result).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it('does not replace longer tokens partially (MMM before MM)', () => {
    const result = formatDate(date, 'MMM MM');
    expect(result).toBe('Feb 02');
  });

  it('preserves literal text', () => {
    expect(formatDate(date, 'Year: YYYY')).toBe('Year: 2026');
  });
});

// --- applyFilter ---

describe('applyFilter', () => {
  describe('date', () => {
    it('formats a Date object', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      const result = applyFilter(d, { name: 'date', arg: 'YYYY-MM-DD' });
      // Date renders in local timezone, so just check it looks like a date
      expect(result).toMatch(/^2026-01-1\d$/);
    });

    it('formats an ISO string', () => {
      const result = applyFilter('2026-01-15T00:00:00.000Z', {
        name: 'date',
        arg: 'YYYY',
      });
      expect(result).toBe('2026');
    });

    it('uses YYYY-MM-DD as default format', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      const result = applyFilter(d, { name: 'date' });
      expect(result).toMatch(/^2026-01-1\d$/);
    });

    it('passes through non-date values', () => {
      expect(applyFilter('not a date', { name: 'date', arg: 'YYYY' })).toBe(
        'not a date',
      );
    });
  });

  describe('lowercase', () => {
    it('lowercases a string', () => {
      expect(applyFilter('HELLO', { name: 'lowercase' })).toBe('hello');
    });

    it('handles null', () => {
      expect(applyFilter(null, { name: 'lowercase' })).toBe('');
    });
  });

  describe('uppercase', () => {
    it('uppercases a string', () => {
      expect(applyFilter('hello', { name: 'uppercase' })).toBe('HELLO');
    });
  });

  describe('default', () => {
    it('returns original value when non-empty', () => {
      expect(applyFilter('hello', { name: 'default', arg: 'fallback' })).toBe(
        'hello',
      );
    });

    it('returns arg when value is null', () => {
      expect(applyFilter(null, { name: 'default', arg: 'fallback' })).toBe(
        'fallback',
      );
    });

    it('returns arg when value is undefined', () => {
      expect(
        applyFilter(undefined, { name: 'default', arg: 'fallback' }),
      ).toBe('fallback');
    });

    it('returns arg when value is empty string', () => {
      expect(applyFilter('', { name: 'default', arg: 'N/A' })).toBe('N/A');
    });

    it('returns empty string when no arg and value is null', () => {
      expect(applyFilter(null, { name: 'default' })).toBe('');
    });
  });

  describe('join', () => {
    it('joins array with default separator', () => {
      expect(applyFilter(['a', 'b', 'c'], { name: 'join' })).toBe('a, b, c');
    });

    it('joins array with custom separator', () => {
      expect(applyFilter(['a', 'b'], { name: 'join', arg: ' | ' })).toBe(
        'a | b',
      );
    });

    it('passes through non-array values', () => {
      expect(applyFilter('hello', { name: 'join' })).toBe('hello');
    });
  });

  describe('slug', () => {
    it('converts to URL-safe slug', () => {
      expect(applyFilter('My Workspace Name', { name: 'slug' })).toBe(
        'my-workspace-name',
      );
    });

    it('strips leading/trailing hyphens', () => {
      expect(applyFilter('  Hello World!  ', { name: 'slug' })).toBe(
        'hello-world',
      );
    });

    it('collapses multiple hyphens', () => {
      expect(applyFilter('a---b', { name: 'slug' })).toBe('a-b');
    });

    it('handles special characters', () => {
      expect(applyFilter("it's a test!", { name: 'slug' })).toBe(
        'it-s-a-test',
      );
    });
  });

  describe('trim', () => {
    it('trims whitespace', () => {
      expect(applyFilter('  hello  ', { name: 'trim' })).toBe('hello');
    });
  });

  describe('truncate', () => {
    it('truncates long strings with ellipsis', () => {
      expect(applyFilter('hello world', { name: 'truncate', arg: '5' })).toBe(
        'hello\u2026',
      );
    });

    it('passes through strings shorter than limit', () => {
      expect(
        applyFilter('hello', { name: 'truncate', arg: '10' }),
      ).toBe('hello');
    });

    it('defaults to 100 characters', () => {
      const long = 'a'.repeat(105);
      const result = applyFilter(long, { name: 'truncate' }) as string;
      expect(result.length).toBe(101); // 100 chars + ellipsis
      expect(result.endsWith('\u2026')).toBe(true);
    });
  });

  describe('unknown filter', () => {
    it('passes value through unchanged', () => {
      expect(applyFilter('hello', { name: 'nonexistent' })).toBe('hello');
    });
  });
});

// --- resolveTemplateValue ---

describe('resolveTemplateValue', () => {
  const context: TemplateContext = {
    channel: 'engineering',
    message_count: 42,
    tags: ['slack', 'export'],
    empty_val: '',
    null_val: null,
  };

  it('resolves a single expression preserving string type', () => {
    expect(resolveTemplateValue('{{channel}}', context)).toBe('engineering');
  });

  it('resolves a single expression preserving number type', () => {
    expect(resolveTemplateValue('{{message_count}}', context)).toBe(42);
  });

  it('resolves a single expression preserving array type', () => {
    expect(resolveTemplateValue('{{tags}}', context)).toEqual([
      'slack',
      'export',
    ]);
  });

  it('resolves mixed literals + expressions as string', () => {
    expect(resolveTemplateValue('Channel: {{channel}}', context)).toBe(
      'Channel: engineering',
    );
  });

  it('resolves multiple expressions in one string', () => {
    expect(
      resolveTemplateValue('{{channel}} ({{message_count}} msgs)', context),
    ).toBe('engineering (42 msgs)');
  });

  it('resolves expression with filters', () => {
    expect(resolveTemplateValue('{{channel|uppercase}}', context)).toBe(
      'ENGINEERING',
    );
  });

  it('returns empty string for undefined variable in mixed string', () => {
    expect(resolveTemplateValue('Value: {{unknown}}', context)).toBe(
      'Value: ',
    );
  });

  it('returns undefined for single expression with undefined variable', () => {
    expect(resolveTemplateValue('{{unknown}}', context)).toBeUndefined();
  });

  it('returns string with no expressions unchanged', () => {
    expect(resolveTemplateValue('just text', context)).toBe('just text');
  });
});

// --- resolveTemplate ---

describe('resolveTemplate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-12T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const context: TemplateContext = {
    channel: 'engineering',
    source_category: 'slack-channel',
    workspace: 'My Workspace',
    message_count: 42,
    captured: new Date(),
    date_range: '2026-01-15 to 2026-02-12',
    empty_field: '',
  };

  it('resolves all template fields', () => {
    const template = {
      title: '{{channel}}',
      source: '{{source_category}}',
      message_count: '{{message_count}}',
    };

    const result = resolveTemplate(template, context);
    expect(result).toEqual({
      title: 'engineering',
      source: 'slack-channel',
      message_count: 42,
    });
  });

  it('omits fields that resolve to empty/null/undefined', () => {
    const template = {
      title: '{{channel}}',
      topic: '{{empty_field}}',
      unknown: '{{nonexistent}}',
    };

    const result = resolveTemplate(template, context);
    expect(result).toEqual({ title: 'engineering' });
    expect(result).not.toHaveProperty('topic');
    expect(result).not.toHaveProperty('unknown');
  });

  it('resolves array values with expressions', () => {
    const template = {
      tags: ['slack', '{{workspace|lowercase|slug}}'],
    };

    const result = resolveTemplate(template, context);
    expect(result).toEqual({
      tags: ['slack', 'my-workspace'],
    });
  });

  it('filters out empty elements in arrays', () => {
    const template = {
      tags: ['slack', '{{empty_field}}', '{{nonexistent}}', 'export'],
    };

    const result = resolveTemplate(template, context);
    expect(result).toEqual({
      tags: ['slack', 'export'],
    });
  });

  it('omits arrays that resolve to empty after filtering', () => {
    const template = {
      tags: ['{{empty_field}}', '{{nonexistent}}'],
    };

    const result = resolveTemplate(template, context);
    expect(result).not.toHaveProperty('tags');
  });

  it('passes through non-string, non-array values', () => {
    const template = {
      title: '{{channel}}',
      count: 99,
      archived: false,
    };

    const result = resolveTemplate(template, context);
    expect(result).toEqual({
      title: 'engineering',
      count: 99,
      archived: false,
    });
  });

  it('applies date filter with format string', () => {
    const template = {
      captured: '{{captured|date:"YYYY-MM-DD"}}',
    };

    const result = resolveTemplate(template, context);
    // With fake timers set to UTC, the local date might differ, but it should be a date string
    expect(result.captured).toMatch(/^2026-02-1\d$/);
  });

  it('handles a full realistic template', () => {
    const template = {
      title: '{{channel}}',
      source: '{{source_category}}',
      workspace: '{{workspace}}',
      captured: '{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',
      date_range: '{{date_range}}',
      message_count: '{{message_count}}',
      tags: ['slack'],
    };

    const result = resolveTemplate(template, context);
    expect(result.title).toBe('engineering');
    expect(result.source).toBe('slack-channel');
    expect(result.workspace).toBe('My Workspace');
    expect(result.captured).toMatch(/^2026-02-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(result.date_range).toBe('2026-01-15 to 2026-02-12');
    expect(result.message_count).toBe(42);
    expect(result.tags).toEqual(['slack']);
  });
});
