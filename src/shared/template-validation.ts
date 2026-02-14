import type { FrontmatterTemplate, TemplateStore } from './default-templates';

export type ValidationResult =
  | { valid: true; templates: TemplateStore }
  | { valid: false; error: string };

const VALID_CATEGORIES = new Set(['slack', 'web']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateTemplate(id: string, value: unknown): FrontmatterTemplate | string {
  if (!isPlainObject(value)) {
    return `Template "${id}" is not an object`;
  }

  if (typeof value.name !== 'string' || !value.name.trim()) {
    return `Template "${id}" has invalid or missing "name"`;
  }

  if (typeof value.enabled !== 'boolean') {
    return `Template "${id}" has invalid or missing "enabled"`;
  }

  if (!VALID_CATEGORIES.has(value.category as string)) {
    return `Template "${id}" has invalid "category" (must be "slack" or "web")`;
  }

  if (!isPlainObject(value.frontmatter)) {
    return `Template "${id}" has invalid or missing "frontmatter"`;
  }

  // Validate frontmatter values are string or string[]
  for (const [key, fmValue] of Object.entries(value.frontmatter)) {
    if (typeof fmValue === 'string') continue;
    if (
      Array.isArray(fmValue) &&
      fmValue.every((item) => typeof item === 'string')
    ) {
      continue;
    }
    return `Template "${id}" frontmatter field "${key}" must be a string or string[]`;
  }

  return {
    name: value.name as string,
    enabled: value.enabled as boolean,
    category: value.category as 'slack' | 'web',
    frontmatter: value.frontmatter as Record<string, string | string[]>,
  };
}

export function validateTemplateStore(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { valid: false, error: 'File must contain a JSON object' };
  }

  const templates: TemplateStore = {};

  for (const [id, value] of Object.entries(input)) {
    const result = validateTemplate(id, value);
    if (typeof result === 'string') {
      return { valid: false, error: result };
    }
    templates[id] = result;
  }

  return { valid: true, templates };
}
