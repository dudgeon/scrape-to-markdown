import type { AuthProvider } from '../../platform/interfaces';

export class UserscriptAuthProvider implements AuthProvider {
  async getToken(): Promise<string | undefined> {
    const bd = (window as any).boot_data;
    const token = bd?.api_token;
    return typeof token === 'string' && token.startsWith('xoxc-') ? token : undefined;
  }

  async getCookie(): Promise<string | undefined> {
    // GM_xmlhttpRequest sends cookies automatically for the target domain.
    // Return a sentinel so the auth check in slackApiCall passes.
    return '__AUTO__';
  }

  async clearToken(): Promise<void> {
    // No-op: token lives on the page, not in persistent storage.
  }
}
