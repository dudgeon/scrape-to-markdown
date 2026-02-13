import type { StorageAdapter } from '../../platform/interfaces';

export class UserscriptStorage implements StorageAdapter {
  async get<T>(key: string): Promise<T | undefined> {
    return GM_getValue<T | undefined>(key, undefined);
  }

  async set(key: string, value: unknown): Promise<void> {
    GM_setValue(key, value);
  }

  async remove(key: string): Promise<void> {
    GM_deleteValue(key);
  }
}
