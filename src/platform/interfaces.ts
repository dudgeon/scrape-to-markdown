/** Provides the xoxc- token and session cookie. */
export interface AuthProvider {
  getToken(): Promise<string | undefined>;
  getCookie(): Promise<string | undefined>;
  clearToken(): Promise<void>;
}

/**
 * Makes authenticated POST requests to the Slack API.
 * Abstracts fetch() (extension) vs GM_xmlhttpRequest (userscript).
 */
export interface HttpClient {
  post(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<any>;
  }>;
}

/** Key-value storage for caches and settings. */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
