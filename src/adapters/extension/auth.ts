import type { AuthProvider } from '../../platform/interfaces';
import { STORAGE_KEYS } from '../../shared/constants';

export class ExtensionAuthProvider implements AuthProvider {
  async getToken(): Promise<string | undefined> {
    const result = await chrome.storage.session.get(STORAGE_KEYS.TOKEN);
    return result[STORAGE_KEYS.TOKEN] as string | undefined;
  }

  async getCookie(): Promise<string | undefined> {
    const cookie = await chrome.cookies.get({
      url: 'https://app.slack.com',
      name: 'd',
    });
    return cookie ? `d=${cookie.value}` : undefined;
  }

  async clearToken(): Promise<void> {
    await chrome.storage.session.remove(STORAGE_KEYS.TOKEN);
  }
}
