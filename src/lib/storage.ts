import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'lead-photos';
const SIGNED_URL_EXPIRY = 60 * 60 * 24; // 24 hours

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

// In-memory cache to avoid re-signing the same path within a session.
// Keyed by `${path}|${transformKey}`. Soft cap to prevent unbounded growth.
const URL_CACHE_MAX = 500;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function transformKey(t?: ImageTransformOptions): string {
  if (!t) return '';
  return `${t.width ?? ''}x${t.height ?? ''}q${t.quality ?? ''}r${t.resize ?? ''}`;
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
  const marker = `/object/public/${BUCKET}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(urlOrPath.substring(idx + marker.length));
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
  const cached = cacheGet(path, transform);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY, transform ? { transform } : undefined);
  if (error || !data?.signedUrl) {
    console.warn('Failed to create signed URL, falling back:', error?.message);
    return urlOrPath;
  }
  cacheSet(path, data.signedUrl, transform);
  return data.signedUrl;
}

/**
 * Get signed URLs for multiple paths/URLs in batch.
 * When `transform` is provided, falls back to parallel per-item signed URLs
 * because the Supabase JS SDK only supports `transform` on `createSignedUrl`.
 */
export async function getSignedUrls(urlsOrPaths: string[], transform?: ImageTransformOptions): Promise<string[]> {
  if (urlsOrPaths.length === 0) return [];
  const paths = urlsOrPaths.map(extractPath);

  // Fast path with cache: collect any missing paths and only sign those.
  const results: string[] = new Array(paths.length);
  const missingIdx: number[] = [];
  paths.forEach((p, i) => {
    const cached = cacheGet(p, transform);
    if (cached) {
      results[i] = cached;
    } else {
      missingIdx.push(i);
    }
  });
  if (missingIdx.length === 0) return results;

  if (transform) {
    // Per-item parallel calls (SDK batch API doesn't support transforms).
    const signed = await Promise.all(
      missingIdx.map((i) =>
        supabase.storage
          .from(BUCKET)
          .createSignedUrl(paths[i], SIGNED_URL_EXPIRY, { transform })
          .then(({ data, error }) => {
            if (error || !data?.signedUrl) return urlsOrPaths[i];
            cacheSet(paths[i], data.signedUrl, transform);
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
