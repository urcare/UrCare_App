import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/** Kept well under Supabase's actual global Storage upload cap on this
 *  project (confirmed at 50MB — a Dashboard-only setting, not something
 *  this app's own code can raise) rather than right up against it, so a
 *  compressed file still clears the limit even with a little re-encoding
 *  overhead. */
const MAX_UPLOAD_BYTES = 45 * 1024 * 1024;

let ffmpegPromise: Promise<FFmpeg> | null = null;

/** Loads ffmpeg.wasm's single-threaded core from a CDN on first use (not
 *  bundled — it's tens of MB and most people posting a status will never
 *  need it at all, since it only ever runs on a file already over the
 *  cap). Single-threaded specifically because the multi-threaded core
 *  needs cross-origin-isolation response headers this server doesn't set
 *  (and setting them risks breaking the YouTube video embeds elsewhere in
 *  the app) — slower, but works with zero server changes. */
async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

/** Resizes + re-encodes an oversized image as a JPEG, stepping the quality
 *  down until it clears the upload cap. A no-op (returns the original
 *  file) for anything already under the cap — no point burning CPU on a
 *  file that would've uploaded fine as-is. */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  const maxDim = 1920;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const toJpegBlob = (quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

  let quality = 0.85;
  let blob = await toJpegBlob(quality);
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.35) {
    quality -= 0.12;
    blob = await toJpegBlob(quality);
  }
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

/** Scales an oversized video down (max 1280x720) and re-encodes it at a
 *  moderate CRF via ffmpeg.wasm, entirely client-side — no server or paid
 *  storage upgrade needed. A no-op for anything already under the cap.
 *  `onProgress` is called with 0-1 while ffmpeg is actually encoding. */
export async function compressVideoIfNeeded(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  const ffmpeg = await getFFmpeg();
  const onProgressEvent = ({ progress }: { progress: number }) => onProgress?.(Math.min(1, Math.max(0, progress)));
  ffmpeg.on('progress', onProgressEvent);

  const inputExt = file.name.match(/\.\w+$/)?.[0] || '.mp4';
  const inputName = `input${inputExt}`;
  const outputName = 'output.mp4';
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
      '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    return new File([bytes], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', onProgressEvent);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
