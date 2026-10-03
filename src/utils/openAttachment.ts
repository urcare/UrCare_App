/** Opening attachments — chat files, admin-uploaded documents, report
 *  images, payment screenshots (mostly data: URLs, sometimes https URLs).
 *
 *  openAttachment() shows the file inside the app via AttachmentViewer
 *  (mounted once in App.tsx): images full-screen, videos in a player, PDFs
 *  rendered page by page. That matters most in the Android/iOS app: a bare
 *  WebView has no PDF viewer and no reliable download handling, so the old
 *  "open a new tab / force a download" approach showed nothing there.
 *  If the viewer isn't mounted, it falls back to downloadAttachment(). */

export const ATTACHMENT_EVENT = 'urcare:open-attachment';

export type AttachmentRequest = { url: string; name?: string; type?: string };
export type AttachmentKind = 'image' | 'video' | 'pdf' | 'other';

/** Works out what kind of file this is from its declared MIME type, the
 *  data: URL prefix, or the file name's extension — whichever is known. */
export function attachmentKind({ url, name, type }: AttachmentRequest): AttachmentKind {
  const mime = (type || /^data:([^;,]+)/.exec(url)?.[1] || '').toLowerCase();
  const ext = (name || url.split('?')[0]).toLowerCase().split('.').pop() || '';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', '3gp'].includes(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'other';
}

export async function openAttachment(url: string, fileName?: string, fileType?: string): Promise<void> {
  if ((window as any).__urcareAttachmentViewer) {
    window.dispatchEvent(new CustomEvent<AttachmentRequest>(ATTACHMENT_EVENT, { detail: { url, name: fileName, type: fileType } }));
    return;
  }
  return downloadAttachment(url, fileName);
}

/** Saves the file to the device. Goes through a blob: URL because a long
 *  data: URL can silently fail as a navigation/download target. */
export async function downloadAttachment(dataUrl: string, fileName?: string): Promise<void> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'attachment';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    window.open(dataUrl, '_blank');
  }
}
