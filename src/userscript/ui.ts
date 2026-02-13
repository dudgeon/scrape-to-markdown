import type { MessageScope } from '../types/messages';
import type { ExportSlackOptions, ExportSlackResult, ProgressInfo } from '../core/export-slack';
import { fetchChannelInfo } from '../background/slack-api';

declare const __BUILD_VERSION__: string;

export interface UIDeps {
  detectChannel: () => { workspaceId: string; channelId: string } | null;
  exportSlackChannel: (options: ExportSlackOptions) => Promise<ExportSlackResult>;
}

const STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #e1e1e1;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .hidden { display: none !important; }

  .s2md-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #4a6cf7;
    color: #fff;
    border: none;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    z-index: 99999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.15s, background 0.15s;
  }
  .s2md-toggle:hover { background: #3a5ce7; transform: scale(1.1); }

  .s2md-panel {
    position: fixed;
    bottom: 70px;
    right: 20px;
    width: 340px;
    background: #1a1a2e;
    border: 1px solid #333355;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 99998;
    overflow: hidden;
  }

  .s2md-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #22223a;
    border-bottom: 1px solid #333355;
  }
  .s2md-header h2 { font-size: 14px; font-weight: 600; color: #fff; }
  .s2md-close {
    background: none; border: none; color: #8888aa; cursor: pointer;
    font-size: 18px; line-height: 1;
  }
  .s2md-close:hover { color: #fff; }

  .s2md-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }

  .s2md-status { color: #a0a0b8; padding: 4px 0; font-size: 12px; }

  .s2md-field { display: flex; flex-direction: column; gap: 4px; }
  .s2md-label { font-size: 11px; color: #8888aa; text-transform: uppercase; letter-spacing: 0.5px; }
  .s2md-channel { font-family: 'SF Mono','Menlo','Monaco',monospace; font-size: 14px; color: #7eb8ff; }

  select, input[type="date"] {
    background: #2a2a42; color: #e1e1e1; border: 1px solid #444466;
    border-radius: 4px; padding: 6px 8px; font-size: 13px;
  }
  input[type="date"] { padding: 4px 8px; font-size: 12px; color-scheme: dark; }

  .s2md-date-row { flex-direction: row; gap: 8px; }
  .s2md-date-row label { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #8888aa; }

  .s2md-options { gap: 2px; }
  .s2md-options label {
    display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 0;
  }

  .s2md-progress { display: flex; flex-direction: column; gap: 4px; }
  .s2md-progress-bar { width: 100%; height: 4px; background: #2a2a42; border-radius: 2px; overflow: hidden; }
  .s2md-progress-fill { height: 100%; background: #7eb8ff; border-radius: 2px; transition: width 0.3s ease; width: 0%; }
  .s2md-progress-text { font-size: 11px; color: #8888aa; }

  .s2md-actions { display: flex; gap: 8px; }
  .s2md-btn {
    flex: 1; padding: 8px 12px; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s;
  }
  .s2md-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .s2md-btn-primary { background: #4a6cf7; color: #fff; }
  .s2md-btn-primary:hover:not(:disabled) { background: #3a5ce7; }
  .s2md-btn-secondary { background: #2a2a42; color: #e1e1e1; border: 1px solid #444466; }
  .s2md-btn-secondary:hover:not(:disabled) { background: #3a3a52; }

  .s2md-result {
    background: #1a3a1a; border: 1px solid #44cc44; color: #88ff88;
    padding: 8px 10px; border-radius: 6px; font-size: 12px;
  }
  .s2md-error {
    background: #3a1a1a; border: 1px solid #cc4444; color: #ff8888;
    padding: 8px 10px; border-radius: 6px; font-size: 12px;
  }

  .s2md-version { text-align: right; font-size: 10px; color: #555577; margin-top: 4px; }
`;

const PANEL_HTML = `
  <div class="s2md-header">
    <h2>s2md</h2>
    <button class="s2md-close" title="Close">&times;</button>
  </div>
  <div class="s2md-body">
    <div class="s2md-status" id="s2md-status">Detecting channel...</div>

    <div id="s2md-controls" class="hidden">
      <div class="s2md-field">
        <span class="s2md-label">Channel</span>
        <span class="s2md-channel" id="s2md-channel">--</span>
      </div>

      <div class="s2md-field">
        <label class="s2md-label">Export scope</label>
        <select id="s2md-scope">
          <option value="last_50">Last 50</option>
          <option value="last_100" selected>Last 100</option>
          <option value="last_200">Last 200</option>
          <option value="last_500">Last 500</option>
          <option value="date_range">Date range</option>
          <option value="all">All messages</option>
        </select>
      </div>

      <div id="s2md-date-opts" class="s2md-field s2md-date-row hidden">
        <label>From <input type="date" id="s2md-date-from"></label>
        <label>To <input type="date" id="s2md-date-to"></label>
      </div>

      <div class="s2md-field s2md-options">
        <label><input type="checkbox" id="s2md-threads"> Thread replies</label>
        <label><input type="checkbox" id="s2md-reactions" checked> Reactions</label>
        <label><input type="checkbox" id="s2md-files" checked> File references</label>
        <label><input type="checkbox" id="s2md-frontmatter"> YAML frontmatter</label>
      </div>

      <div id="s2md-progress" class="s2md-progress hidden">
        <div class="s2md-progress-bar"><div class="s2md-progress-fill" id="s2md-progress-fill"></div></div>
        <span class="s2md-progress-text" id="s2md-progress-text">Starting...</span>
      </div>

      <div class="s2md-actions">
        <button class="s2md-btn s2md-btn-primary" id="s2md-copy">Copy Markdown</button>
        <button class="s2md-btn s2md-btn-secondary" id="s2md-download">Download .md</button>
      </div>

      <div id="s2md-result" class="s2md-result hidden"></div>
      <div id="s2md-error" class="s2md-error hidden"></div>
    </div>

    <div class="s2md-version" id="s2md-version"></div>
  </div>
`;

export function injectUI(deps: UIDeps): void {
  // Create shadow DOM host
  const host = document.createElement('div');
  host.id = 's2md-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  // Toggle button
  const toggle = document.createElement('button');
  toggle.className = 's2md-toggle';
  toggle.textContent = 'md';
  toggle.title = 'scrape-to-markdown';
  shadow.appendChild(toggle);

  // Panel
  const panel = document.createElement('div');
  panel.className = 's2md-panel hidden';
  panel.innerHTML = PANEL_HTML;
  shadow.appendChild(panel);

  // Refs
  const $ = (sel: string) => shadow.querySelector(sel)!;
  const statusEl = $('#s2md-status') as HTMLElement;
  const controlsEl = $('#s2md-controls') as HTMLElement;
  const channelEl = $('#s2md-channel') as HTMLElement;
  const scopeSelect = $('#s2md-scope') as HTMLSelectElement;
  const dateOpts = $('#s2md-date-opts') as HTMLElement;
  const dateFrom = $('#s2md-date-from') as HTMLInputElement;
  const dateTo = $('#s2md-date-to') as HTMLInputElement;
  const threadsCheck = $('#s2md-threads') as HTMLInputElement;
  const reactionsCheck = $('#s2md-reactions') as HTMLInputElement;
  const filesCheck = $('#s2md-files') as HTMLInputElement;
  const frontmatterCheck = $('#s2md-frontmatter') as HTMLInputElement;
  const progressEl = $('#s2md-progress') as HTMLElement;
  const progressFill = $('#s2md-progress-fill') as HTMLElement;
  const progressText = $('#s2md-progress-text') as HTMLElement;
  const copyBtn = $('#s2md-copy') as HTMLButtonElement;
  const downloadBtn = $('#s2md-download') as HTMLButtonElement;
  const resultEl = $('#s2md-result') as HTMLElement;
  const errorEl = $('#s2md-error') as HTMLElement;
  const versionEl = $('#s2md-version') as HTMLElement;
  const closeBtn = shadow.querySelector('.s2md-close') as HTMLButtonElement;

  // Version
  try { versionEl.textContent = `v${__BUILD_VERSION__}`; } catch { /* not defined */ }

  // State
  let currentChannelId: string | null = null;
  let currentChannelName: string | null = null;
  let panelOpen = false;

  // Toggle panel
  toggle.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.classList.toggle('hidden', !panelOpen);
    if (panelOpen) detectAndInit();
  });

  closeBtn.addEventListener('click', () => {
    panelOpen = false;
    panel.classList.add('hidden');
  });

  // Scope change — show/hide date fields
  scopeSelect.addEventListener('change', () => {
    dateOpts.classList.toggle('hidden', scopeSelect.value !== 'date_range');
  });

  // Set default dates
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  dateTo.value = now.toISOString().split('T')[0];
  dateFrom.value = weekAgo.toISOString().split('T')[0];

  function getScope(): MessageScope {
    const val = scopeSelect.value;
    if (val === 'date_range') {
      const oldest = dateFrom.value ? new Date(dateFrom.value).getTime() / 1000 : 0;
      const latest = dateTo.value ? new Date(dateTo.value + 'T23:59:59').getTime() / 1000 : Date.now() / 1000;
      return { mode: 'date_range', oldest, latest };
    }
    if (val === 'all') return { mode: 'all' };
    const count = parseInt(val.replace('last_', ''), 10);
    return { mode: 'last_n', count };
  }

  function onProgress(progress: ProgressInfo): void {
    progressEl.classList.remove('hidden');
    const labels: Record<string, string> = {
      fetching: 'Fetching messages',
      resolving_users: 'Resolving users',
      fetching_threads: 'Fetching threads',
      converting: 'Converting',
    };
    const label = labels[progress.phase] || progress.phase;
    if (progress.total) {
      const pct = Math.round((progress.current / progress.total) * 100);
      progressFill.style.width = `${pct}%`;
      progressText.textContent = `${label}: ${progress.current}/${progress.total}`;
    } else {
      progressFill.style.width = '';
      progressText.textContent = progress.current > 0
        ? `${label} (page ${progress.current})...`
        : `${label}...`;
    }
  }

  async function runExport(): Promise<string | null> {
    if (!currentChannelId) return null;
    resultEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    progressEl.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting...';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;

    try {
      const result = await deps.exportSlackChannel({
        channelId: currentChannelId,
        scope: getScope(),
        includeThreads: threadsCheck.checked,
        includeReactions: reactionsCheck.checked,
        includeFiles: filesCheck.checked,
        includeFrontmatter: frontmatterCheck.checked,
        onProgress,
      });

      resultEl.textContent = `Exported ${result.messageCount} messages`;
      resultEl.classList.remove('hidden');
      return result.markdown;
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      errorEl.classList.remove('hidden');
      return null;
    } finally {
      progressEl.classList.add('hidden');
      copyBtn.disabled = false;
      downloadBtn.disabled = false;
    }
  }

  copyBtn.addEventListener('click', async () => {
    const md = await runExport();
    if (md) {
      await navigator.clipboard.writeText(md);
      resultEl.textContent += ' — copied!';
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const md = await runExport();
    if (!md) return;
    const filename = currentChannelName
      ? `${currentChannelName}-${new Date().toISOString().split('T')[0]}.md`
      : `slack-export-${new Date().toISOString().split('T')[0]}.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    resultEl.textContent += ' — downloaded!';
  });

  // Detect channel and initialize controls
  async function detectAndInit(): Promise<void> {
    const ch = deps.detectChannel();
    if (!ch) {
      statusEl.textContent = 'Navigate to a Slack channel to begin.';
      controlsEl.classList.add('hidden');
      statusEl.classList.remove('hidden');
      return;
    }

    currentChannelId = ch.channelId;

    try {
      const info = await fetchChannelInfo(ch.channelId);
      currentChannelName = info.name;
      channelEl.textContent = `#${info.name}`;
    } catch {
      channelEl.textContent = ch.channelId;
    }

    statusEl.classList.add('hidden');
    controlsEl.classList.remove('hidden');
  }

  // Re-detect on URL change (Slack uses History API)
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (panelOpen) detectAndInit();
    }
  }, 2000);
}
