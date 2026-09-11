// Renders every page of a PDF into its own JPEG image, client-side, entirely
// in the browser — used by UploadDailyPlanModal so a user's own multi-page
// daily-plan PDF (a doctor's printout can easily run 20-60+ pages once you
// count cover pages, disclaimers, diet guides, etc.) can still be read by the
// vision model behind /api/analyze-daily-plan, which only ever accepts a
// single image per call, never raw PDF bytes.
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Not a functional ceiling for a real daily-plan document (a 60+ page
// upload is expected and handled) — purely a backstop against a truly
// pathological file (a 1000-page PDF someone uploads by mistake) turning
// into hundreds of sequential AI calls and an effectively-frozen tab.
export const MAX_PDF_PAGES = 80;

export interface PdfRenderResult {
  /** One data:image/jpeg;base64,... string per rendered page, in order. */
  images: string[];
  totalPages: number;
  /** True only if totalPages exceeded MAX_PDF_PAGES and some trailing pages
   *  were skipped. */
  truncated: boolean;
}

/** Cheap page-count read (no rendering) — used right after the user picks a
 *  PDF so the picker can immediately show "62-page PDF" instead of staying
 *  ambiguous until they hit Analyze. */
export async function getPdfPageCount(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  return pdf.numPages;
}

/** Renders each page of `file` to a JPEG data URL. `onProgress` fires after
 *  every page so the caller can show "Reading page X of Y…". */
export async function renderPdfPagesToImages(
  file: File,
  onProgress?: (pageDone: number, totalToRender: number) => void,
): Promise<PdfRenderResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = pdf.numPages;
  const pagesToRender = Math.min(totalPages, MAX_PDF_PAGES);
  const images: string[] = [];

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    // Scale 1.5 keeps text legible for a typical printed/scanned schedule
    // without producing an unreasonably large payload per page.
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not render this PDF in your browser.');
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.82));
    onProgress?.(i, pagesToRender);
  }

  return { images, totalPages, truncated: totalPages > pagesToRender };
}
