import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'lead-photos';
const SIGNED_URL_EXPIRY = 60 * 60 * 24; // 24 hours

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

/**
 * Supabase image transforms require the Pro tier. If the project is on Free,
 * transform-signed URLs return errors when the browser fetches the image.
 * Components can call `markTransformsBroken()` from `<img onError>` once,
 * and we'll skip transforms (and clear the cached broken URLs) for the
 * remainder of the session. We persist the decision in sessionStorage so
 * the flag survives reloads within the tab.
 */
const TRANSFORMS_BROKEN_KEY = 'lovable_supabase_transforms_broken';
let transformsBroken: boolean = (() => {
  try {
    return sessionStorage.getItem(TRANSFORMS_BROKEN_KEY) === '1';
  } catch {
    return false;
  }
})();

const transformBrokenListeners = new Set<() => void>();

export function markTransformsBroken() {
  if (transformsBroken) return;
  transformsBroken = true;
  try {
    sessionStorage.setItem(TRANSFORMS_BROKEN_KEY, '1');
  } catch {
    /* ignore */
  }
  // Drop any cached transformed URLs so we don't keep handing out broken ones.
  for (const key of Array.from(urlCache.keys())) {
    if (key.includes('|') && !key.endsWith('|')) {
      urlCache.delete(key);
    }
  }
  transformBrokenListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* ignore */
    }
  });
}

export function onTransformsBroken(cb: () => void): () => void {
  transformBrokenListeners.add(cb);
  return () => transformBrokenListeners.delete(cb);
}

export function areTransformsBroken() {
  return transformsBroken;
}

// In-memory cache to avoid re-signing the same path within a session.
// Keyed by `${path}|${transformKey}`. Soft cap to prevent unbounded growth.
const URL_CACHE_MAX = 500;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function transformKey(t?: ImageTransformOptions): string {
  if (!t) return '';
  return `${t.width ?? ''}x${t.height ?? ''}q${t.quality ?? ''}r${t.resize ?? ''}`;
}

function effectiveTransform(t?: ImageTransformOptions): ImageTransformOptions | undefined {
  if (transformsBroken) return undefined;
  return t;
}

function cacheGet(path: string, t?: ImageTransformOptions): string | null {
  const key = `${path}|${transformKey(t)}`;
  const hit = urlCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    urlCache.delete(key);
    return null;
  }
  return hit.url;
}

function cacheSet(path: string, url: string, t?: ImageTransformOptions) {
  if (urlCache.size >= URL_CACHE_MAX) {
    // Evict oldest (first inserted) entry.
    const firstKey = urlCache.keys().next().value;
    if (firstKey) urlCache.delete(firstKey);
  }
  const key = `${path}|${transformKey(t)}`;
  // Expire cache entry slightly before signed URL expiry.
  urlCache.set(key, { url, expiresAt: Date.now() + (SIGNED_URL_EXPIRY - 60) * 1000 });
}

/**
 * Extract the storage path from a full public URL or return path as-is.
 */
function extractPath(urlOrPath: string): string {
  // Handle signed URLs: /object/sign/<bucket>/<path>?token=...
  // Handle public URLs: /object/public/<bucket>/<path>
  const markers = [`/object/sign/${BUCKET}/`, `/object/public/${BUCKET}/`];
  for (const marker of markers) {
    const idx = urlOrPath.indexOf(marker);
    if (idx !== -1) {
      const after = urlOrPath.substring(idx + marker.length);
      const pathOnly = after.split("?")[0];
      return decodeURIComponent(pathOnly);
    }
  }
  return urlOrPath;
}

/**
 * Upload a file and return the storage path (not full URL).
 */
export async function uploadToStorage(path: string, file: File) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

/**
 * Get a signed URL for a storage path or existing public URL.
 * Returns the original string if signing fails (graceful fallback).
 */
export async function getSignedUrl(urlOrPath: string, transform?: ImageTransformOptions): Promise<string> {
  const path = extractPath(urlOrPath);
  const t = effectiveTransform(transform);
  const cached = cacheGet(path, t);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY, t ? { transform: t } : undefined);
  if (error || !data?.signedUrl) {
    console.warn('Failed to create signed URL, falling back:', error?.message);
    return urlOrPath;
  }
  cacheSet(path, data.signedUrl, t);
  return data.signedUrl;
}

/**
 * Get signed URLs for multiple paths/URLs in batch.
 * When `transform` is provided, falls back to parallel per-item signed URLs
 * because the Supabase JS SDK only supports `transform` on `createSignedUrl`.
 */
export async function getSignedUrls(urlsOrPaths: string[], transform?: ImageTransformOptions): Promise<string[]> {
  if (urlsOrPaths.length === 0) return [];
  const t = effectiveTransform(transform);
  const paths = urlsOrPaths.map(extractPath);

  // Fast path with cache: collect any missing paths and only sign those.
  const results: string[] = new Array(paths.length);
  const missingIdx: number[] = [];
  paths.forEach((p, i) => {
    const cached = cacheGet(p, t);
    if (cached) {
      results[i] = cached;
    } else {
      missingIdx.push(i);
    }
  });
  if (missingIdx.length === 0) return results;

  if (t) {
    // Per-item parallel calls (SDK batch API doesn't support transforms).
    const signed = await Promise.all(
      missingIdx.map((i) =>
        supabase.storage
          .from(BUCKET)
          .createSignedUrl(paths[i], SIGNED_URL_EXPIRY, { transform: t })
          .then(({ data, error }) => {
            if (error || !data?.signedUrl) return urlsOrPaths[i];
            cacheSet(paths[i], data.signedUrl, t);
            return data.signedUrl;
          }),
      ),
    );
    missingIdx.forEach((origIdx, k) => {
      results[origIdx] = signed[k];
    });
    return results;
  }

  const missingPaths = missingIdx.map((i) => paths[i]);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(missingPaths, SIGNED_URL_EXPIRY);
  if (error || !data) {
    console.warn('Failed to create signed URLs, falling back:', error?.message);
    missingIdx.forEach((i) => {
      results[i] = urlsOrPaths[i];
    });
    return results;
  }
  data.forEach((d, k) => {
    const origIdx = missingIdx[k];
    const url = d.signedUrl || urlsOrPaths[origIdx];
    results[origIdx] = url;
    if (d.signedUrl) cacheSet(paths[origIdx], d.signedUrl);
  });
  return results;
}
