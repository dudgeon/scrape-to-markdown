import { STORAGE_KEYS } from '../shared/constants';

// Inlined page-world script that reads boot_data.api_token.
// Must run in the page context (not extension isolated world) to access window.boot_data.
const INJECTED_CODE = `
(function() {
  try {
    var bd = window.boot_data || (window.TS && window.TS.boot_data);
    var token = bd && bd.api_token;
    if (token && typeof token === 'string' && token.startsWith('xoxc-')) {
      window.postMessage({ type: '__S2MD_TOKEN__', token: token }, 'https://app.slack.com');
    }
  } catch(e) {}
})();
`;

export function startTokenExtraction(): void {
  // Inject the page-world script as a blob URL (CSP-compatible)
  const blob = new Blob([INJECTED_CODE], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const script = document.createElement('script');
  script.src = url;
  document.documentElement.appendChild(script);
  script.onload = () => {
    script.remove();
    URL.revokeObjectURL(url);
  };

  // Listen for the token posted back from the injected script
  window.addEventListener('message', (event) => {
    if (
      event.origin !== 'https://app.slack.com' ||
      event.data?.type !== '__S2MD_TOKEN__'
    ) {
      return;
    }

    const token = event.data.token;
    if (typeof token !== 'string' || !token.startsWith('xoxc-')) return;

    chrome.storage.session.set({ [STORAGE_KEYS.TOKEN]: token });
    chrome.runtime.sendMessage({ type: 'TOKEN_READY', token }).catch(() => {
      // Service worker may not be listening yet
    });
  });
}
