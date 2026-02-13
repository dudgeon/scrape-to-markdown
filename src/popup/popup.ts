import type {
  StatusResponse,
  FetchMessagesResponse,
  GetStatusRequest,
  MessageScope,
  ProgressMessage,
} from '../types/messages';
import { parseSlackUrl } from '../shared/url-parser';
import { clipPage } from '../core/clip-page';
import {
  buildWebClipFrontmatterFromTemplate,
  serializeFrontmatter,
  type WebClipFrontmatterContext,
} from '../background/markdown/frontmatter';
import { getActiveTemplate, initTemplateStorage } from '../shared/template-storage';
import { ExtensionSyncStorage } from '../adapters/extension/storage';

// Init template storage so the popup can read templates for web clip frontmatter
initTemplateStorage(new ExtensionSyncStorage());

// Elements
const statusEl = document.getElementById('status')!;
const controlsEl = document.getElementById('controls')!;
const channelNameEl = document.getElementById('channel-name')!;
const messageCountEl = document.getElementById('message-count') as HTMLSelectElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const resultEl = document.getElementById('result')!;
const resultMessageEl = document.getElementById('result-message')!;
const errorEl = document.getElementById('error')!;
const errorTextEl = document.getElementById('error-text')!;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const progressEl = document.getElementById('progress')!;
const progressFill = document.getElementById('progress-fill')!;
const progressText = document.getElementById('progress-text')!;
const lastNOptions = document.getElementById('last-n-options')!;
const dateRangeOptions = document.getElementById('date-range-options')!;
const dateFrom = document.getElementById('date-from') as HTMLInputElement;
const dateTo = document.getElementById('date-to') as HTMLInputElement;
const includeThreads = document.getElementById('include-threads') as HTMLInputElement;
const includeReactions = document.getElementById('include-reactions') as HTMLInputElement;
const includeFiles = document.getElementById('include-files') as HTMLInputElement;
const includeFrontmatter = document.getElementById('include-frontmatter') as HTMLInputElement;
const settingsLink = document.getElementById('frontmatter-settings');

settingsLink?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Web clip elements
const clipControlsEl = document.getElementById('clip-controls')!;
const clipPageTitle = document.getElementById('clip-page-title')!;
const clipIncludeFrontmatter = document.getElementById('clip-include-frontmatter') as HTMLInputElement;
const clipCopyBtn = document.getElementById('clip-copy-btn') as HTMLButtonElement;
const clipDownloadBtn = document.getElementById('clip-download-btn') as HTMLButtonElement;
const clipResultEl = document.getElementById('clip-result')!;
const clipResultMessage = document.getElementById('clip-result-message')!;
const clipProgressEl = document.getElementById('clip-progress')!;
const clipProgressFill = document.getElementById('clip-progress-fill')!;
const clipProgressText = document.getElementById('clip-progress-text')!;
const clipSettingsLink = document.getElementById('clip-frontmatter-settings');

clipSettingsLink?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

declare const __BUILD_VERSION__: string;

let currentChannelId: string | null = null;
let currentChannelName: string | null = null;
let lastMarkdown: string | null = null;
let activeTabId: number | null = null;
let activeTabUrl: string = '';
let activeTabTitle: string = '';
let lastExportAction: 'copy' | 'download' | null = null;

// Display build version
const versionEl = document.querySelector('.version');
if (versionEl) versionEl.textContent = `v${__BUILD_VERSION__}`;

// Scope radio buttons
const scopeRadios = document.querySelectorAll<HTMLInputElement>('input[name="scope"]');
scopeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    const value = radio.value;
    lastNOptions.classList.toggle('hidden', value !== 'last_n');
    dateRangeOptions.classList.toggle('hidden', value !== 'date_range');
  });
});

// Listen for progress messages from service worker
chrome.runtime.onMessage.addListener((message: ProgressMessage) => {
  if (message.type !== 'PROGRESS') return;

  progressEl.classList.remove('hidden');

  const phaseLabels: Record<string, string> = {
    fetching: 'Fetching messages',
    resolving_users: 'Resolving users',
    fetching_threads: 'Fetching threads',
    converting: 'Converting to markdown',
  };

  const label = phaseLabels[message.phase] || message.phase;

  if (message.total) {
    const pct = Math.round((message.current / message.total) * 100);
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${label}: ${message.current}/${message.total}`;
  } else {
    progressFill.style.width = '';
    progressText.textContent = message.current > 0
      ? `${label} (page ${message.current})...`
      : `${label}...`;
  }
});

function getSelectedScope(): MessageScope {
  const selected = document.querySelector<HTMLInputElement>('input[name="scope"]:checked')!.value;

  if (selected === 'date_range') {
    const oldest = dateFrom.value
      ? new Date(dateFrom.value).getTime() / 1000
      : 0;
    const latest = dateTo.value
      ? new Date(dateTo.value + 'T23:59:59').getTime() / 1000
      : Date.now() / 1000;
    return { mode: 'date_range', oldest, latest };
  }

  if (selected === 'all') {
    return { mode: 'all' };
  }

  return { mode: 'last_n', count: parseInt(messageCountEl.value, 10) };
}

async function exportMessages(): Promise<string | null> {
  if (!currentChannelId) return null;

  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  progressEl.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Starting...';
  copyBtn.disabled = true;
  downloadBtn.disabled = true;

  try {
    const response: FetchMessagesResponse = await chrome.runtime.sendMessage({
      type: 'FETCH_MESSAGES',
      channelId: currentChannelId,
      scope: getSelectedScope(),
      includeThreads: includeThreads.checked,
      includeReactions: includeReactions.checked,
      includeFiles: includeFiles.checked,
      includeFrontmatter: includeFrontmatter.checked,
    });

    if (!response.success || !response.markdown) {
      showError(response.error || 'Export failed', response.errorCategory);
      return null;
    }

    lastMarkdown = response.markdown;
    resultMessageEl.textContent = `Exported ${response.messageCount} messages`;
    resultEl.classList.remove('hidden');
    return response.markdown;
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Unknown error');
    return null;
  } finally {
    progressEl.classList.add('hidden');
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
  }
}

copyBtn.addEventListener('click', async () => {
  lastExportAction = 'copy';
  const markdown = await exportMessages();
  if (markdown) {
    await navigator.clipboard.writeText(markdown);
    resultMessageEl.textContent += ' — copied to clipboard!';
  }
});

downloadBtn.addEventListener('click', async () => {
  lastExportAction = 'download';
  const markdown = await exportMessages();
  if (!markdown) return;

  const filename = currentChannelName
    ? `${currentChannelName}-${new Date().toISOString().split('T')[0]}.md`
    : `slack-export-${new Date().toISOString().split('T')[0]}.md`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  resultMessageEl.textContent += ' — downloaded!';
});

// --- Web clip handlers ---

async function clipCurrentPage(): Promise<string | null> {
  if (!activeTabId) return null;

  clipResultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  clipProgressEl.classList.remove('hidden');
  clipProgressFill.style.width = '50%';
  clipProgressText.textContent = 'Extracting article...';
  clipCopyBtn.disabled = true;
  clipDownloadBtn.disabled = true;

  try {
    // Inject a function to grab the page HTML + selection
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: () => {
        let selectedHtml: string | undefined;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const container = document.createElement('div');
          container.appendChild(sel.getRangeAt(0).cloneContents());
          selectedHtml = container.innerHTML;
        }
        return {
          html: document.documentElement.outerHTML,
          url: location.href,
          title: document.title,
          selectedHtml,
        };
      },
    });

    if (!result?.result) {
      showError('Could not read page content.');
      return null;
    }

    clipProgressFill.style.width = '80%';
    clipProgressText.textContent = 'Converting to markdown...';

    const clip = clipPage(result.result);
    let markdown = clip.markdown;

    // Prepend YAML frontmatter if enabled
    if (clipIncludeFrontmatter.checked) {
      const fmCtx: WebClipFrontmatterContext = {
        title: clip.title,
        sourceUrl: activeTabUrl,
        author: clip.byline,
        siteName: clip.siteName,
        excerpt: clip.excerpt,
      };

      let frontmatter: string;
      try {
        const template = await getActiveTemplate('web');
        if (template) {
          frontmatter = buildWebClipFrontmatterFromTemplate(template, fmCtx);
        } else {
          frontmatter = serializeFrontmatter({
            title: clip.title,
            source: 'web-clip',
            source_url: activeTabUrl,
            author: clip.byline || '',
            captured: new Date().toISOString(),
            tags: ['web-clip'],
          });
        }
      } catch {
        frontmatter = serializeFrontmatter({
          title: clip.title,
          source: 'web-clip',
          source_url: activeTabUrl,
          captured: new Date().toISOString(),
          tags: ['web-clip'],
        });
      }

      markdown = frontmatter + '\n\n' + markdown;
    }

    lastMarkdown = markdown;
    activeTabTitle = clip.title || activeTabTitle;
    clipResultMessage.textContent = result.result.selectedHtml
      ? 'Clipped selection'
      : 'Clipped article';
    clipResultEl.classList.remove('hidden');
    return markdown;
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Clip failed');
    return null;
  } finally {
    clipProgressEl.classList.add('hidden');
    clipCopyBtn.disabled = false;
    clipDownloadBtn.disabled = false;
  }
}

clipCopyBtn.addEventListener('click', async () => {
  const markdown = await clipCurrentPage();
  if (markdown) {
    await navigator.clipboard.writeText(markdown);
    clipResultMessage.textContent += ' — copied to clipboard!';
  }
});

clipDownloadBtn.addEventListener('click', async () => {
  const markdown = await clipCurrentPage();
  if (!markdown) return;

  const slug = activeTabTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const filename = `${slug || 'clip'}-${new Date().toISOString().split('T')[0]}.md`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  clipResultMessage.textContent += ' — downloaded!';
});

function showError(message: string, category?: 'auth' | 'transient' | 'permanent') {
  errorTextEl.textContent = category === 'auth'
    ? 'Session expired. Please refresh Slack and try again.'
    : message;
  retryBtn.classList.toggle('hidden', category !== 'transient');
  errorEl.classList.remove('hidden');
}

retryBtn.addEventListener('click', () => {
  if (lastExportAction === 'copy') copyBtn.click();
  else if (lastExportAction === 'download') downloadBtn.click();
});

// Initialize
async function init() {
  try {
    // Query the active tab to determine context (Slack channel or other page)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeUrl = tab?.url || '';
    const slackIds = parseSlackUrl(activeUrl);

    // Build status request with active-tab IDs (avoids stale global storage)
    const statusRequest: GetStatusRequest = {
      type: 'GET_STATUS',
      ...(slackIds && { channelId: slackIds.channelId, workspaceId: slackIds.workspaceId }),
    };

    if (!slackIds) {
      // Non-Slack tab — show web clip mode
      activeTabId = tab?.id ?? null;
      activeTabUrl = activeUrl;
      activeTabTitle = tab?.title || activeUrl;
      clipPageTitle.textContent = activeTabTitle;
      clipPageTitle.title = activeUrl;
      statusEl.classList.add('hidden');
      clipControlsEl.classList.remove('hidden');
      return;
    }

    const status: StatusResponse = await chrome.runtime.sendMessage(statusRequest);

    if (!status.hasToken) {
      statusEl.textContent = 'No Slack session detected. Please open Slack and refresh the page.';
      return;
    }

    if (!status.channelId) {
      statusEl.textContent = 'Please navigate to a Slack channel.';
      return;
    }

    currentChannelId = status.channelId;
    currentChannelName = status.channelName || null;
    channelNameEl.textContent = status.channelName
      ? `#${status.channelName}`
      : status.channelId;

    // Set default date range to last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateTo.value = now.toISOString().split('T')[0];
    dateFrom.value = weekAgo.toISOString().split('T')[0];

    statusEl.classList.add('hidden');
    controlsEl.classList.remove('hidden');
  } catch {
    showError('Failed to connect to extension. Try reloading the page.');
  }
}

init();
