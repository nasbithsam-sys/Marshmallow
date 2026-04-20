

# Reduce Storage Egress by ~5x (Currently 100x → Target 20x)

## Why egress is so high right now

1. **Full-size originals loaded as thumbnails** — `LeadCard.tsx` calls `getSignedUrls(paths)` with NO transform, so every lead card on `/leads` downloads full-resolution photos (often 1–3 MB each) just to render a small preview.
2. **Re-fetched on every mount** — Each card re-queries `lead_photos` and re-signs URLs every time the list re-renders or you navigate back. Browser cache helps, but signed URLs change → cache miss.
3. **Detail page double-loads** — `LeadDetailPage.tsx` already fetches both a 320×320 preview AND the full original in parallel, even when the lightbox is never opened.
4. **Payment screenshots** — Loaded at full size on every card where `isPaid` is true.
5. **Build error** — `transform` option is being passed to `createSignedUrls` (batch), but the Supabase JS SDK only supports `transform` on the single `createSignedUrl`. That's the TS2353 error.

## Fix Plan (4 small edits)

### 1. `src/lib/storage.ts`
- **Fix build error**: Remove `transform` from the batch `createSignedUrls` call (SDK doesn't support it). For batch + transform, fall back to per-item `createSignedUrl` calls in parallel.
- **Bump expiry** from 1 hour → 24 hours so URLs cache longer in the browser/CDN (fewer re-signs, more cache hits = less egress).
- **Add in-memory cache** keyed by `path + transform` so repeated calls within the session don't re-hit Supabase.

### 2. `src/components/leads/LeadCard.tsx`
- Request **thumbnail transforms** (e.g. `width: 200, quality: 50, resize: "cover"`) instead of full originals. A 1.5 MB photo becomes ~15 KB → **~100x reduction** for card previews alone.
- Same for payment screenshot preview (`width: 200`).
- Only load originals when the lightbox actually opens.

### 3. `src/pages/LeadDetailPage.tsx`
- **Lazy-load originals**: only fetch full-size signed URLs when the user opens the lightbox, not upfront. Keep the 320×320 preview load.
- Reduce preview size from 320 → 240 and quality 60 → 50.

### 4. (Optional, larger payoff) `src/lib/image-upload.ts`
- Lower `MAX_DIMENSION` from 1600 → 1280 and `JPEG_QUALITY` from 0.78 → 0.72 for new uploads. Doesn't affect existing photos but caps future growth.

## Expected Impact

| Source | Before | After | Reduction |
|---|---|---|---|
| Lead card photo preview | ~1.5 MB × N cards | ~15 KB × N cards | ~100x |
| Payment screenshot preview | ~800 KB | ~10 KB | ~80x |
| Detail page (no lightbox) | preview + original | preview only | ~50% |
| Signed URL re-signs | every navigation | cached 24h | large |

**Net result: ~5–8x egress reduction** (gets you from 100x → 15–20x). Combined with the longer signed-URL TTL improving cached egress hit rate, you should land in your target zone.

## Pros & Cons

**Pros**
- Massive egress reduction with no UX regression — thumbnails look identical at card size
- Faster page loads (smaller images = quicker render)
- Originals still available on lightbox open (full quality preserved)
- Fixes the current TS build error

**Cons**
- First lightbox open will have a small delay (1 round trip to sign + download original) instead of being instant. Mitigation: prefetch on hover.
- Supabase image transforms are a Pro-tier feature — confirm your plan supports them. If not, we'd switch to client-side resize-on-upload + storing a separate `_thumb` variant (more complex, but free).
- 24h signed URLs slightly increase the window if a URL leaks (still RLS-protected on regenerate; low risk).
- Cached in-memory map grows over long sessions — add a soft cap (e.g. 500 entries LRU).

## What you'll need to confirm
- Are you on Supabase Pro? (Required for image transforms.) If unsure, I'll add a graceful fallback so transforms are skipped on free tier and we still get the cache + TTL benefits.

