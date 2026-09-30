/** A real, always-working YouTube search results link for a step's exact
 *  title — the "Watch Video" action on exercise/movement steps, since we
 *  can't host or generate a real demonstration video ourselves. Opens in a
 *  new tab; YouTube's own search finds the best-matching real video. */
export function youtubeSearchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} exercise how to`)}`;
}

/** An embeddable YouTube player pointed at the same search query, for an
 *  in-app "play right here" modal — we have no YouTube Data API key to
 *  resolve a specific, verified video id per (arbitrary, user-defined)
 *  exercise title, so a single wrong hardcoded id would be worse than this
 *  across different exercises. The modal that uses this always also shows a
 *  plain "Open in YouTube" link right below the player, so there's never a
 *  dead end if a given browser/region doesn't play the embedded search. */
export function youtubeSearchEmbedUrl(title: string): string {
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(`${title} exercise how to`)}&autoplay=1`;
}
