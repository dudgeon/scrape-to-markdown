import type {
  StatusResponse,
  FetchMessagesResponse,
  MessageScope,
  ProgressMessage,
} from '../types/messages';

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

declare const __BUILD_VERSION__: string;

let currentChannelId: string | null = null;
let currentChannelName: string | null = null;
let lastMarkdown: string | null = null;

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
    });

    if (!response.success || !response.markdown) {
      showError(response.error || 'Export failed');
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
  const markdown = await exportMessages();
  if (markdown) {
    await navigator.clipboard.writeText(markdown);
    resultMessageEl.textContent += ' — copied to clipboard!';
  }
});

downloadBtn.addEventListener('click', async () => {
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

function showError(message: string) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

// Initialize
async function init() {
  try {
    const status: StatusResponse = await chrome.runtime.sendMessage({
      type: 'GET_STATUS',
    });

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
