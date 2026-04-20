import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'lead-photos';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
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
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY, transform ? { transform } : undefined);
  if (error || !data?.signedUrl) {
    console.warn('Failed to create signed URL, falling back:', error?.message);
    return urlOrPath;
  }
  return data.signedUrl;
}

/**
 * Get signed URLs for multiple paths/URLs in batch.
 */
export async function getSignedUrls(urlsOrPaths: string[], transform?: ImageTransformOptions): Promise<string[]> {
  if (urlsOrPaths.length === 0) return [];
  const paths = urlsOrPaths.map(extractPath);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRY, transform ? { transform } : undefined);
  if (error || !data) {
    console.warn('Failed to create signed URLs, falling back:', error?.message);
    return urlsOrPaths;
  }
  return data.map((d, i) => d.signedUrl || urlsOrPaths[i]);
}
