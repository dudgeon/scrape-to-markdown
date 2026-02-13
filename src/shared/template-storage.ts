import type { StorageAdapter } from '../platform/interfaces';
import { STORAGE_KEYS } from './constants';
import {
  DEFAULT_TEMPLATES,
  type FrontmatterTemplate,
  type TemplateStore,
} from './default-templates';

let _storage: StorageAdapter;

export function initTemplateStorage(storage: StorageAdapter): void {
  _storage = storage;
}

/**
 * Merge stored templates with defaults.
 * Stored templates take priority; missing default IDs are added.
 * Pure function — exported for testing.
 */
export function mergeWithDefaults(stored: TemplateStore | null): TemplateStore {
  if (!stored) return structuredClone(DEFAULT_TEMPLATES);

  const merged = { ...stored };
  for (const [id, template] of Object.entries(DEFAULT_TEMPLATES)) {
    if (!(id in merged)) {
      merged[id] = structuredClone(template);
    }
  }
  return merged;
}

/**
 * Find the active (enabled) template for a given category.
 * Pure function — exported for testing.
 */
export function findActiveTemplate(
  templates: TemplateStore,
  category: 'slack' | 'web',
): FrontmatterTemplate | null {
  for (const template of Object.values(templates)) {
    if (template.category === category && template.enabled) {
      return template;
    }
  }
  return null;
}

/** Load all templates from storage, merging with defaults. */
export async function loadTemplates(): Promise<TemplateStore> {
  const stored = await _storage.get<TemplateStore>(STORAGE_KEYS.TEMPLATES);
  return mergeWithDefaults(stored ?? null);
}

/** Save the full template store to storage. */
export async function saveTemplates(templates: TemplateStore): Promise<void> {
  await _storage.set(STORAGE_KEYS.TEMPLATES, templates);
}

/** Get the active template for a category. Returns null if none found. */
export async function getActiveTemplate(
  category: 'slack' | 'web',
): Promise<FrontmatterTemplate | null> {
  const templates = await loadTemplates();
  return findActiveTemplate(templates, category);
}

/** Remove stored templates, reverting to defaults on next load. */
export async function resetTemplates(): Promise<void> {
  await _storage.remove(STORAGE_KEYS.TEMPLATES);
}
