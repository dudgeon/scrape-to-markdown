import {
  loadTemplates,
  saveTemplates,
  initTemplateStorage,
} from '../shared/template-storage';
import { ExtensionSyncStorage } from '../adapters/extension/storage';

// Initialize platform adapter (options page runs in its own context)
initTemplateStorage(new ExtensionSyncStorage());
import {
  BUILTIN_TEMPLATE_IDS,
  DEFAULT_TEMPLATES,
  type FrontmatterTemplate,
  type TemplateStore,
} from '../shared/default-templates';
import {
  resolveTemplate,
  type TemplateContext,
} from '../background/markdown/template-engine';
import { serializeFrontmatter } from '../background/markdown/frontmatter';

// --- Elements ---

const slackTemplatesEl = document.getElementById('slack-templates')!;
const addSlackBtn = document.getElementById('add-slack-template') as HTMLButtonElement;
const editorEl = document.getElementById('editor')!;
const editorTitle = document.getElementById('editor-title')!;
const templateNameInput = document.getElementById('template-name') as HTMLInputElement;
const fieldsContainer = document.getElementById('fields-container')!;
const addFieldBtn = document.getElementById('add-field') as HTMLButtonElement;
const previewEl = document.getElementById('preview')!;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const deleteBtn = document.getElementById('delete-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

// --- State ---

let templates: TemplateStore = {};
let editingTemplateId: string | null = null;

// Sample context for live preview
const PREVIEW_CONTEXT: TemplateContext = {
  channel: 'engineering',
  channel_id: 'C024BE91L',
  channel_type: 'public_channel',
  topic: 'Engineering discussions',
  purpose: 'A place for engineering talk',
  workspace: 'My Workspace',
  workspace_domain: 'myworkspace',
  source_category: 'slack-channel',
  source_url: 'https://myworkspace.slack.com/archives/C024BE91L',
  captured: new Date(),
  date_range: '2026-01-15 to 2026-02-12',
  message_count: 156,
  export_scope: 'last_100',
};

// --- Rendering ---

function renderTemplateList(): void {
  slackTemplatesEl.innerHTML = '';

  const slackEntries = Object.entries(templates).filter(
    ([, t]) => t.category === 'slack',
  );

  for (const [id, template] of slackEntries) {
    const row = document.createElement('div');
    row.className = 'template-row' + (template.enabled ? ' active' : '');

    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'active-slack';
    radio.checked = template.enabled;
    radio.addEventListener('change', () => onActivate(id, 'slack'));

    const nameSpan = document.createElement('span');
    nameSpan.className = 'template-name';
    nameSpan.textContent = template.name;

    label.appendChild(radio);
    label.appendChild(nameSpan);

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditor(id));

    row.appendChild(label);
    row.appendChild(editBtn);
    slackTemplatesEl.appendChild(row);
  }
}

function renderFields(frontmatter: Record<string, string | string[]>): void {
  fieldsContainer.innerHTML = '';

  for (const [key, value] of Object.entries(frontmatter)) {
    addFieldRow(key, serializeFieldValue(value));
  }
}

function addFieldRow(key: string = '', value: string = ''): void {
  const row = document.createElement('div');
  row.className = 'field-row';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'field-key';
  keyInput.value = key;
  keyInput.placeholder = 'key';
  keyInput.addEventListener('input', updatePreview);

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.className = 'field-value';
  valueInput.value = value;
  valueInput.placeholder = 'value or {{variable|filter}}';
  valueInput.addEventListener('input', updatePreview);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-field';
  removeBtn.textContent = '\u00d7';
  removeBtn.title = 'Remove field';
  removeBtn.addEventListener('click', () => {
    row.remove();
    updatePreview();
  });

  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  fieldsContainer.appendChild(row);
}

/** Convert a field value to its editable string form */
function serializeFieldValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/** Parse an editable string back to a field value */
function parseFieldValue(str: string): string | string[] {
  const trimmed = str.trim();
  // Try to parse as JSON array
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not valid JSON, treat as string
    }
  }
  return str;
}

/** Collect the current editor fields into a frontmatter object */
function collectFields(): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const rows = fieldsContainer.querySelectorAll('.field-row');

  for (const row of rows) {
    const keyInput = row.querySelector('.field-key') as HTMLInputElement;
    const valueInput = row.querySelector('.field-value') as HTMLInputElement;
    const key = keyInput.value.trim();
    if (!key) continue;
    result[key] = parseFieldValue(valueInput.value);
  }

  return result;
}

function updatePreview(): void {
  try {
    const frontmatter = collectFields();
    // Resolve template expressions for preview
    const resolvedForPreview: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value === 'string') {
        resolvedForPreview[key] = value;
      } else {
        resolvedForPreview[key] = value;
      }
    }
    const resolved = resolveTemplate(resolvedForPreview, PREVIEW_CONTEXT);
    previewEl.textContent = serializeFrontmatter(resolved);
  } catch {
    previewEl.textContent = '(preview error)';
  }
}

// --- Actions ---

async function onActivate(id: string, category: 'slack' | 'web'): Promise<void> {
  // Disable all templates in this category, enable the selected one
  for (const [tid, template] of Object.entries(templates)) {
    if (template.category === category) {
      template.enabled = tid === id;
    }
  }
  await saveTemplates(templates);
  renderTemplateList();
}

function openEditor(id: string): void {
  editingTemplateId = id;
  const template = templates[id];
  if (!template) return;

  editorTitle.textContent = `Edit: ${template.name}`;
  templateNameInput.value = template.name;
  deleteBtn.disabled = BUILTIN_TEMPLATE_IDS.has(id);
  deleteBtn.title = BUILTIN_TEMPLATE_IDS.has(id)
    ? 'Built-in templates cannot be deleted'
    : 'Delete this template';

  renderFields(template.frontmatter);
  updatePreview();
  editorEl.classList.remove('hidden');
}

function closeEditor(): void {
  editingTemplateId = null;
  editorEl.classList.add('hidden');
}

async function onSave(): Promise<void> {
  if (!editingTemplateId) return;

  const template = templates[editingTemplateId];
  if (!template) return;

  template.name = templateNameInput.value.trim() || template.name;
  template.frontmatter = collectFields();

  await saveTemplates(templates);
  renderTemplateList();
  closeEditor();
}

async function onDelete(): Promise<void> {
  if (!editingTemplateId || BUILTIN_TEMPLATE_IDS.has(editingTemplateId)) return;

  delete templates[editingTemplateId];
  await saveTemplates(templates);
  renderTemplateList();
  closeEditor();
}

function onAddTemplate(): void {
  const id = `custom_${Date.now()}`;
  templates[id] = {
    name: 'New Template',
    enabled: false,
    category: 'slack',
    frontmatter: {
      title: '{{channel}}',
      source: '{{source_category}}',
      captured: '{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',
      tags: ['slack'],
    },
  };
  renderTemplateList();
  openEditor(id);
}

async function onReset(): Promise<void> {
  templates = structuredClone(DEFAULT_TEMPLATES);
  await saveTemplates(templates);
  renderTemplateList();
  closeEditor();
}

// --- Event listeners ---

addSlackBtn.addEventListener('click', onAddTemplate);
addFieldBtn.addEventListener('click', () => {
  addFieldRow();
  updatePreview();
});
saveBtn.addEventListener('click', onSave);
cancelBtn.addEventListener('click', closeEditor);
deleteBtn.addEventListener('click', onDelete);
resetBtn.addEventListener('click', onReset);

// --- Init ---

async function init(): Promise<void> {
  templates = await loadTemplates();
  renderTemplateList();
}

init();
