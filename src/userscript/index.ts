import { initSlackApi } from '../background/slack-api';
import { initUserCache } from '../background/user-cache';
import { initTemplateStorage } from '../shared/template-storage';
import { UserscriptAuthProvider } from '../adapters/userscript/auth';
import { UserscriptHttpClient } from '../adapters/userscript/http';
import { UserscriptStorage } from '../adapters/userscript/storage';
import { exportSlackChannel } from '../core/export-slack';
import { injectUI } from './ui';

console.log('[s2md] script starting');

try {
  // Wire up platform adapters
  const storage = new UserscriptStorage();
  initSlackApi(new UserscriptAuthProvider(), new UserscriptHttpClient());
  initUserCache(storage);
  initTemplateStorage(storage);

  // Channel detection — direct URL parsing (no content script needed)
  function detectChannel(): { workspaceId: string; channelId: string } | null {
    const match = location.pathname.match(/^\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i);
    return match ? { workspaceId: match[1], channelId: match[2] } : null;
  }

  // Delay injection so Slack's SPA doesn't wipe the body during init
  function tryInject(): void {
    if (!document.body) {
      console.log('[s2md] no document.body yet, retrying...');
      setTimeout(tryInject, 500);
      return;
    }
    console.log('[s2md] injecting UI');
    injectUI({ detectChannel, exportSlackChannel });
    console.log('[s2md] UI injected');
  }

  if (document.readyState === 'complete') {
    tryInject();
  } else {
    window.addEventListener('load', tryInject);
  }
} catch (err) {
  console.error('[s2md] init error:', err);
}
