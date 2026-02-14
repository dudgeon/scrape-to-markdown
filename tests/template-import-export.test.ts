import { describe, it, expect } from 'vitest';
import { validateTemplateStore } from '../src/shared/template-validation';

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Template',
    enabled: true,
    category: 'slack',
    frontmatter: {
      title: '{{channel}}',
      tags: ['slack'],
    },
    ...overrides,
  };
}

describe('validateTemplateStore', () => {
  it('accepts a valid template store', () => {
    const input = {
      my_template: makeTemplate(),
      another: makeTemplate({ name: 'Another', category: 'web', enabled: false }),
    };

    const result = validateTemplateStore(input);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(Object.keys(result.templates)).toEqual(['my_template', 'another']);
      expect(result.templates['my_template'].name).toBe('Test Template');
      expect(result.templates['another'].category).toBe('web');
    }
  });

  it('accepts an empty object (no templates)', () => {
    const result = validateTemplateStore({});
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(Object.keys(result.templates)).toHaveLength(0);
    }
  });

  it('rejects non-object input (array)', () => {
    const result = validateTemplateStore([makeTemplate()]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('JSON object');
    }
  });

  it('rejects non-object input (string)', () => {
    const result = validateTemplateStore('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects null input', () => {
    const result = validateTemplateStore(null);
    expect(result.valid).toBe(false);
  });

  it('rejects template with missing name', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ name: undefined }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('"bad"');
      expect(result.error).toContain('name');
    }
  });

  it('rejects template with empty name', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ name: '  ' }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('name');
    }
  });

  it('rejects template with invalid enabled value', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ enabled: 'yes' }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('enabled');
    }
  });

  it('rejects template with invalid category', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ category: 'email' }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('category');
    }
  });

  it('rejects template with missing frontmatter', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ frontmatter: undefined }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('frontmatter');
    }
  });

  it('rejects template with non-object frontmatter', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ frontmatter: 'not an object' }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('frontmatter');
    }
  });

  it('rejects template with invalid frontmatter values (number)', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ frontmatter: { title: 'ok', count: 42 } }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('count');
      expect(result.error).toContain('string or string[]');
    }
  });

  it('rejects template with invalid frontmatter values (boolean)', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ frontmatter: { title: 'ok', active: true } }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('active');
    }
  });

  it('rejects template with mixed array values', () => {
    const result = validateTemplateStore({
      bad: makeTemplate({ frontmatter: { tags: ['slack', 42] } }),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('tags');
    }
  });

  it('accepts template with string array frontmatter values', () => {
    const result = validateTemplateStore({
      ok: makeTemplate({ frontmatter: { tags: ['slack', 'export'] } }),
    });
    expect(result.valid).toBe(true);
  });

  it('rejects template that is not an object', () => {
    const result = validateTemplateStore({ bad: 'not a template' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('"bad"');
    }
  });
});
