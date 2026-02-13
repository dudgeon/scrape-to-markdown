import type { HttpClient } from '../../platform/interfaces';

export class UserscriptHttpClient implements HttpClient {
  post(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ ok: boolean; status: number; json(): Promise<any> }> {
    return new Promise((resolve, reject) => {
      // Strip the Cookie header — GM_xmlhttpRequest sends cookies automatically
      const { Cookie: _, ...safeHeaders } = headers;

      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers: safeHeaders,
        data: body,
        onload: (resp) =>
          resolve({
            ok: resp.status >= 200 && resp.status < 300,
            status: resp.status,
            json: () => Promise.resolve(JSON.parse(resp.responseText)),
          }),
        onerror: (err) => reject(new Error(`Network error: ${err.error}`)),
      });
    });
  }
}
