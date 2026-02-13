interface GM_XHRResponse {
  status: number;
  statusText: string;
  responseText: string;
  responseHeaders: string;
  finalUrl: string;
}

interface GM_XHRDetails {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  data?: string;
  onload?: (response: GM_XHRResponse) => void;
  onerror?: (error: { error: string }) => void;
}

declare function GM_xmlhttpRequest(details: GM_XHRDetails): void;
declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_deleteValue(key: string): void;
