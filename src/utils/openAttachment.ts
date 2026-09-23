/** Opens a data: URL (how every file attachment in this app is stored —
 *  chat files, admin-uploaded documents, report images, etc.) reliably,
 *  regardless of file size or type, and regardless of whether it's being
 *  viewed in a normal browser tab or inside the app's embedded WebView
 *  (the Android APK, via Capacitor).
 *
 *  Two separate problems this works around:
 *  1) Navigating straight to a `data:` URL via `<a href target="_blank">`
 *     works for small files, but a real photo/PDF (often 1-4MB, i.e. a
 *     base64 string well over a million characters) can silently fail to
 *     render once the data: URL gets long enough as a navigation target.
 *     Converting it to a `blob:` URL first (via fetch, which DOES support
 *     data: URLs directly) sidesteps that — blob: URLs have no such
 *     length ceiling.
 *  2) `window.open(blobUrl)` renders fine for images (the browser/WebView
 *     can always paint an <img>), but a bare embedded WebView has no
 *     built-in PDF (or .docx etc.) viewer the way a full desktop/mobile
 *     browser does — opening a PDF blob: URL in a new "tab" there just
 *     shows blank. Forcing a real download instead sidesteps that too:
 *     every OS knows how to save + hand a downloaded file to whatever app
 *     is registered to open it. */
export async function openAttachment(dataUrl: string, fileName?: string): Promise<void> {
  let blobUrl: string | null = null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    blobUrl = URL.createObjectURL(blob);
    if (blob.type.startsWith('image/')) {
      const win = window.open(blobUrl, '_blank');
      if (!win) window.location.href = dataUrl;
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    const url = blobUrl;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // If the conversion itself fails for some reason, still try the plain
    // data: URL rather than doing nothing.
    window.open(dataUrl, '_blank');
  }
}
