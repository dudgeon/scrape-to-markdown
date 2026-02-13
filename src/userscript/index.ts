import { initSlackApi } from '../background/slack-api';
import { initUserCache } from '../background/user-cache';
import { initTemplateStorage } from '../shared/template-storage';
import { UserscriptAuthProvider } from '../adapters/userscript/auth';
import { UserscriptHttpClient } from '../adapters/userscript/http';
import { UserscriptStorage } from '../adapters/userscript/storage';
import { exportSlackChannel } from '../core/export-slack';
import { injectUI } from './ui';

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

// Inject floating panel and wire up export
injectUI({ detectChannel, exportSlackChannel });
