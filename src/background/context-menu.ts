import type { ClipPageOffscreenRequest } from '../types/messages';
import type { ClipResult } from '../core/clip-page';
import {
  buildWebClipFrontmatterFromTemplate,
  serializeFrontmatter,
  type WebClipFrontmatterContext,
} from './markdown/frontmatter';
import { getActiveTemplate } from '../shared/template-storage';

const OFFSCREEN_URL = 'src/offscreen/offscreen.html';

/** Register context menu items. Call once at service worker startup. */
export function setupContextMenu(): void {
  chrome.contextMenus.create({
    id: 's2md-clip-page',
    title: 'Copy page as Markdown',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 's2md-clip-selection',
    title: 'Copy selection as Markdown',
    contexts: ['selection'],
  });

  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}

async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (!tab?.id || !info.menuItemId?.toString().startsWith('s2md-')) return;

  try {
    const markdown = await clipAndBuildMarkdown(tab.id, tab.url || '');
    if (!markdown) return;

    // Copy to clipboard via injected script (activeTab grants permission on context menu click)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text: string) => navigator.clipboard.writeText(text),
      args: [markdown],
    });

    // Flash badge to confirm
    chrome.action.setBadgeText({ text: 'MD' });
    chrome.action.setBadgeBackgroundColor({ color: '#4a6cf7' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  } catch (err) {
    console.error('[s2md] Context menu clip failed:', err);
  }
}

/**
 * Shared clip pipeline for context menu and keyboard shortcut.
 * Extracts page data, runs clipPage via offscreen doc, builds frontmatter.
 */
export async function clipAndBuildMarkdown(
  tabId: number,
  tabUrl: string,
): Promise<string | null> {
  // 1. Extract page data from the active tab
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
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

  if (!result?.result) return null;

  // 2. Ensure offscreen document exists
  await ensureOffscreenDocument();

  // 3. Send to offscreen document for DOM processing
  const clipMessage: ClipPageOffscreenRequest = {
    type: 'CLIP_PAGE_OFFSCREEN',
    target: 'offscreen',
    pageData: result.result,
  };

  const clipResult: ClipResult & { success: boolean; error?: string } =
    await chrome.runtime.sendMessage(clipMessage);

  if (!clipResult.success) {
    console.error('[s2md] Clip failed:', clipResult.error);
    return null;
  }

  // 4. Build frontmatter
  let markdown = clipResult.markdown;
  try {
    const fmCtx: WebClipFrontmatterContext = {
      title: clipResult.title,
      sourceUrl: tabUrl,
      author: clipResult.byline,
      siteName: clipResult.siteName,
      excerpt: clipResult.excerpt,
    };

    const template = await getActiveTemplate('web');
    let frontmatter: string;
    if (template) {
      frontmatter = buildWebClipFrontmatterFromTemplate(template, fmCtx);
    } else {
      frontmatter = serializeFrontmatter({
        title: clipResult.title,
        source: 'web-clip',
        source_url: tabUrl,
        captured: new Date().toISOString(),
        tags: ['web-clip'],
      });
    }
    markdown = frontmatter + '\n\n' + markdown;
  } catch {
    // Frontmatter generation failed — return markdown without it
  }

  return markdown;
}

let _offscreenCreating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  // Check if already exists
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length > 0) return;

  // Avoid race condition with concurrent creation attempts
  if (_offscreenCreating) {
    await _offscreenCreating;
    return;
  }

  _offscreenCreating = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: 'Parse page HTML with DOMParser for Readability article extraction',
  });

  await _offscreenCreating;
  _offscreenCreating = null;
}
