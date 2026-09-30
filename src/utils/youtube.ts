import { authedFetch } from './supabase';

/** A real, always-working YouTube search results link for a step's exact
 *  title — the "Watch Video" action on exercise/movement steps, since we
 *  can't host or generate a real demonstration video ourselves. Opens in a
 *  new tab; YouTube's own search finds the best-matching real video. Used
 *  both as the "Open in YouTube" link inside the player modal, and as the
 *  whole action when no real video id could be resolved (see below). */
export function youtubeSearchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} exercise how to`)}`;
}

/** An embeddable YouTube player for a specific, real video id — only ever
 *  playable once we have a real id from resolveYoutubeVideoId below. (An
 *  earlier version embedded a live YouTube *search* instead of one video,
 *  since there was no API key to resolve a specific id — YouTube has since
 *  dropped support for that embed mode, it just shows "This video is
 *  unavailable" now, so that approach no longer works at all.) */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
}

const videoIdCache = new Map<string, Promise<string | null>>();

/** Resolves a real, specific YouTube video id for an exercise title via the
 *  server's /api/youtube-search (backed by the real YouTube Data API v3 —
 *  see server.ts for the YOUTUBE_API_KEY setup this needs). Returns null
 *  when no key is configured yet or nothing was found, so callers can fall
 *  back to the plain search link instead of a broken embed. Cached per
 *  title for the lifetime of the page — the same exercise title is looked
 *  up repeatedly (hero card, timeline row, Home's featured card) and the
 *  answer never changes within one session. */
export async function resolveYoutubeVideoId(title: string): Promise<string | null> {
  const cached = videoIdCache.get(title);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const res = await authedFetch(`/api/youtube-search?q=${encodeURIComponent(title)}`, { method: 'GET' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.videoId || null;
    } catch {
      return null;
    }
  })();
  videoIdCache.set(title, promise);
  return promise;
}
