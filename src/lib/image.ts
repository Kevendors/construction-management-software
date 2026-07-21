// Client-side image handling for the no-backend (localStorage) model.
// Resizes/compresses a picked image to a small JPEG data URL so multiple
// photos can be stored in localStorage without blowing the ~5MB quota.

export async function fileToResizedDataUrl(
  file: File,
  maxDim = 1100,
  quality = 0.65
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode failed"));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Grab the current frame of a live <video> (camera stream) as a JPEG data
 * URL, capped to maxDim on the longest side. Used for attendance selfies —
 * capturing from the stream (not a file input) is what guarantees the photo
 * is live and not picked from the gallery.
 */
export function videoFrameToDataUrl(
  video: HTMLVideoElement,
  maxDim = 1080,
  quality = 0.75
): string | null {
  let width = video.videoWidth;
  let height = video.videoHeight;
  if (!width || !height) return null;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
