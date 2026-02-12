import { STORAGE_KEYS } from '../shared/constants';
import { fetchUserInfo } from './slack-api';

type UserCacheMap = Record<string, string>;

let memoryCache: UserCacheMap = {};
let loaded = false;

async function loadCache(): Promise<void> {
  if (loaded) return;
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CACHE);
  memoryCache = (result[STORAGE_KEYS.USER_CACHE] as UserCacheMap | undefined) || {};
  loaded = true;
}

async function persistCache(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_CACHE]: memoryCache });
}

export async function resolveUser(userId: string): Promise<string> {
  await loadCache();
  if (memoryCache[userId]) return memoryCache[userId];

  const info = await fetchUserInfo(userId);
  memoryCache[userId] = info.displayName;
  await persistCache();
  return info.displayName;
}

export async function resolveUsers(userIds: string[]): Promise<Record<string, string>> {
  await loadCache();

  const result: Record<string, string> = {};
  const toFetch: string[] = [];

  for (const id of userIds) {
    if (memoryCache[id]) {
      result[id] = memoryCache[id];
    } else {
      toFetch.push(id);
    }
  }

  for (const id of toFetch) {
    const info = await fetchUserInfo(id);
    memoryCache[id] = info.displayName;
    result[id] = info.displayName;
  }

  if (toFetch.length > 0) {
    await persistCache();
  }

  return result;
}
