import React, { useEffect, useState } from 'react';
import { X, Download, RefreshCw, FileText } from 'lucide-react';
import { ATTACHMENT_EVENT, AttachmentRequest, attachmentKind, downloadAttachment } from '../utils/openAttachment';

/** Mounted once (App.tsx). Opens any attachment — chat files, report
 *  photos, admin-sent documents, payment screenshots — inside the app:
 *  images full-screen, videos in a player, PDFs rendered page by page.
 *  This works the same in the browser and in the Android/iOS app, where a
 *  bare WebView can't open a PDF or a downloaded file on its own. */
export const AttachmentViewer: React.FC = () => {
  const [request, setRequest] = useState<AttachmentRequest | null>(null);
  const [pdfPages, setPdfPages] = useState<string[] | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ total: number; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (window as any).__urcareAttachmentViewer = true;
    const handler = (e: Event) => setRequest((e as CustomEvent<AttachmentRequest>).detail);
    window.addEventListener(ATTACHMENT_EVENT, handler);
    return () => {
      (window as any).__urcareAttachmentViewer = false;
      window.removeEventListener(ATTACHMENT_EVENT, handler);
    };
  }, []);

  const kind = request ? attachmentKind(request) : null;

  useEffect(() => {
    setPdfPages(null);
    setPdfInfo(null);
    setError(null);
    if (!request || kind !== 'pdf') return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await (await fetch(request.url)).blob();
        const file = new File([blob], request.name || 'document.pdf', { type: 'application/pdf' });
        const { renderPdfPagesToImages } = await import('../utils/pdfToImages');
        const result = await renderPdfPagesToImages(file);
        if (cancelled) return;
        setPdfPages(result.images);
        setPdfInfo({ total: result.totalPages, truncated: result.truncated });
      } catch {
        if (!cancelled) setError('This PDF could not be opened here. You can download it instead.');
      }
    })();
    return () => { cancelled = true; };
  }, [request, kind]);

  if (!request) return null;
  const close = () => setRequest(null);

  return (
    <div className="fixed inset-0 z-[11000] bg-black/90 flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white shrink-0">
        <span className="text-sm font-bold truncate">{request.name || 'Attachment'}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => downloadAttachment(request.url, request.name)}
            className="p-2 rounded-full hover:bg-white/10 cursor-pointer"
            aria-label="Download"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button type="button" onClick={close} className="p-2 rounded-full hover:bg-white/10 cursor-pointer" aria-label="Close" title="Close">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center p-2 sm:p-4" onClick={kind === 'image' ? close : undefined}>
        {kind === 'image' && (
          <img src={request.url} alt={request.name || ''} className="max-w-full max-h-full object-contain m-auto" onClick={(e) => e.stopPropagation()} />
        )}

        {kind === 'video' && (
          <video src={request.url} controls autoPlay playsInline className="max-w-full max-h-full m-auto rounded-lg" />
        )}

        {kind === 'pdf' && (
          <div className="w-full max-w-3xl space-y-3">
            {error ? (
              <p className="text-center text-white/80 text-sm mt-10">{error}</p>
            ) : !pdfPages ? (
              <div className="flex flex-col items-center gap-2 text-white/80 mt-16">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-sm">Opening PDF…</span>
              </div>
            ) : (
              <>
                {pdfPages.map((src, i) => (
                  <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full bg-white rounded-lg shadow" />
                ))}
                {pdfInfo?.truncated && (
                  <p className="text-center text-white/70 text-xs pb-4">
                    Showing the first {pdfPages.length} of {pdfInfo.total} pages. Download the file to see the rest.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {kind === 'other' && (
          <div className="text-center text-white mt-16 space-y-3">
            <FileText className="w-10 h-10 mx-auto opacity-80" />
            <p className="text-sm opacity-80">This file type can't be previewed in the app.</p>
            <button
              type="button"
              onClick={() => downloadAttachment(request.url, request.name)}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer"
            >
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
