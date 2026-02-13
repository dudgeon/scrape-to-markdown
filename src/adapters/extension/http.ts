import type { HttpClient } from '../../platform/interfaces';

export class ExtensionHttpClient implements HttpClient {
  async post(url: string, headers: Record<string, string>, body: string) {
    return fetch(url, { method: 'POST', headers, body });
  }
}
