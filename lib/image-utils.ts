/**
 * Client-side image utilities — compress/resize base64 images before sending to API.
 * Prevents "Request Entity Too Large" errors when multiple images are in the payload.
 */

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

/**
 * Compress a base64 data URL image to a smaller size.
 * Resizes to MAX_DIMENSION max and re-encodes as JPEG.
 * Returns the compressed base64 data URL.
 * If the image is a remote URL (not base64), returns it unchanged.
 */
export async function compressImageForApi(imageUrl: string): Promise<string> {
  // Only compress base64 data URLs — remote URLs are fine as-is
  if (!imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;

      // Scale down if larger than MAX_DIMENSION
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageUrl); // fallback to original
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      // Re-encode as JPEG for smaller size
      const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(compressed);
    };
    img.onerror = () => {
      resolve(imageUrl); // fallback to original on error
    };
    img.src = imageUrl;
  });
}

/**
 * Compress an array of image URLs for API payload.
 */
export async function compressImagesForApi(imageUrls: string[]): Promise<string[]> {
  return Promise.all(imageUrls.map(compressImageForApi));
}
