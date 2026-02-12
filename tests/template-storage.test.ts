import { describe, it, expect } from 'vitest';
import { mergeWithDefaults, findActiveTemplate } from '../src/shared/template-storage';
import { DEFAULT_TEMPLATES, type TemplateStore } from '../src/shared/default-templates';

// --- mergeWithDefaults ---

describe('mergeWithDefaults', () => {
  it('returns defaults when stored is null', () => {
    const result = mergeWithDefaults(null);
    expect(Object.keys(result)).toEqual(Object.keys(DEFAULT_TEMPLATES));
    expect(result.slack_default.name).toBe('Slack Default');
    expect(result.slack_default.enabled).toBe(true);
  });

  it('returns a deep copy (not a reference to DEFAULT_TEMPLATES)', () => {
    const result = mergeWithDefaults(null);
    result.slack_default.name = 'Modified';
    expect(DEFAULT_TEMPLATES.slack_default.name).toBe('Slack Default');
  });

  it('preserves stored templates as-is', () => {
    const stored: TemplateStore = {
      slack_default: {
        name: 'My Custom Template',
        enabled: true,
        category: 'slack',
        frontmatter: { title: '{{channel}}' },
      },
    };

    const result = mergeWithDefaults(stored);
    expect(result.slack_default.name).toBe('My Custom Template');
    expect(result.slack_default.frontmatter).toEqual({ title: '{{channel}}' });
  });

  it('adds missing defaults to stored set', () => {
    const stored: TemplateStore = {
      slack_default: {
        name: 'Custom',
        enabled: true,
        category: 'slack',
        frontmatter: { title: '{{channel}}' },
      },
    };

    const result = mergeWithDefaults(stored);
    // slack_detailed and web_default should be added from defaults
    expect(result.slack_detailed).toBeDefined();
    expect(result.slack_detailed.name).toBe('Slack Detailed');
    expect(result.web_default).toBeDefined();
    expect(result.web_default.name).toBe('Web Clip Default');
  });

  it('preserves custom user templates alongside defaults', () => {
    const stored: TemplateStore = {
      slack_default: DEFAULT_TEMPLATES.slack_default,
      my_custom: {
        name: 'My Template',
        enabled: false,
        category: 'slack',
        frontmatter: { title: 'Custom {{channel}}' },
      },
    };

    const result = mergeWithDefaults(stored);
    expect(result.my_custom).toBeDefined();
    expect(result.my_custom.name).toBe('My Template');
    // Missing defaults still added
    expect(result.slack_detailed).toBeDefined();
    expect(result.web_default).toBeDefined();
  });

  it('does not overwrite stored templates with defaults', () => {
    const stored: TemplateStore = {
      slack_default: {
        name: 'Renamed Default',
        enabled: true,
        category: 'slack',
        frontmatter: { custom: 'value' },
      },
      slack_detailed: {
        name: 'Renamed Detailed',
        enabled: false,
        category: 'slack',
        frontmatter: { other: 'field' },
      },
      web_default: {
        name: 'Renamed Web',
        enabled: true,
        category: 'web',
        frontmatter: { url: '{{source_url}}' },
      },
    };

    const result = mergeWithDefaults(stored);
    expect(result.slack_default.name).toBe('Renamed Default');
    expect(result.slack_detailed.name).toBe('Renamed Detailed');
    expect(result.web_default.name).toBe('Renamed Web');
  });
});

// --- findActiveTemplate ---

describe('findActiveTemplate', () => {
  it('finds the enabled slack template', () => {
    const result = findActiveTemplate(DEFAULT_TEMPLATES, 'slack');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Slack Default');
    expect(result!.category).toBe('slack');
    expect(result!.enabled).toBe(true);
  });

  it('finds the enabled web template', () => {
    const result = findActiveTemplate(DEFAULT_TEMPLATES, 'web');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Web Clip Default');
  });

  it('returns null when no template is enabled for category', () => {
    const templates: TemplateStore = {
      slack_a: {
        name: 'A',
        enabled: false,
        category: 'slack',
        frontmatter: {},
      },
      slack_b: {
        name: 'B',
        enabled: false,
        category: 'slack',
        frontmatter: {},
      },
    };

    expect(findActiveTemplate(templates, 'slack')).toBeNull();
  });

  it('returns null for empty store', () => {
    expect(findActiveTemplate({}, 'slack')).toBeNull();
    expect(findActiveTemplate({}, 'web')).toBeNull();
  });

  it('ignores templates from other categories', () => {
    const templates: TemplateStore = {
      web_default: {
        name: 'Web',
        enabled: true,
        category: 'web',
        frontmatter: {},
      },
    };

    expect(findActiveTemplate(templates, 'slack')).toBeNull();
  });
});
