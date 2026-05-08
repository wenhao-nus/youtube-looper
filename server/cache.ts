import { getCache } from '@vercel/functions';

type CacheSetOptions = {
  name: string;
  tags: string[];
  ttlSeconds: number;
};

const memoryCache = new Map<string, unknown>();
const runtimeCache = getCache({
  namespace: 'youtube-section-looper',
});

export async function getCachedValue<T>(key: string): Promise<T | null> {
  const memoryValue = memoryCache.get(key);

  if (memoryValue) {
    return memoryValue as T;
  }

  const runtimeValue = await runtimeCache.get(key);

  if (!runtimeValue) {
    return null;
  }

  memoryCache.set(key, runtimeValue);
  return runtimeValue as T;
}

export async function setCachedValue(
  key: string,
  value: unknown,
  { name, tags, ttlSeconds }: CacheSetOptions,
): Promise<void> {
  memoryCache.set(key, value);
  await runtimeCache.set(key, value, {
    name,
    tags,
    ttl: ttlSeconds,
  });
}
