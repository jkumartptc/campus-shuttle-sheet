// Normalize an image File: apply EXIF orientation, downscale if huge, re-encode JPEG.
// Fixes the mobile-portrait sideways issue caused by EXIF rotation being ignored.

const MAX_DIM = 1600;
const QUALITY = 0.9;

export async function normalizeImageFile(file: File, maxDim = MAX_DIM): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    // createImageBitmap with imageOrientation:"from-image" honors EXIF on all modern browsers.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    let { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", QUALITY),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
