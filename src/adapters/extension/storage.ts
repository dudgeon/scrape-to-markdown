import type { StorageAdapter } from '../../platform/interfaces';

export class ExtensionLocalStorage implements StorageAdapter {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}

export class ExtensionSyncStorage implements StorageAdapter {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.sync.get(key);
    return result[key] as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.sync.remove(key);
  }
}
