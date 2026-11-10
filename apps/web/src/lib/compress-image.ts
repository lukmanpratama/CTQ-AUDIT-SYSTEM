// Shrinks a photo in the browser before it is uploaded. Phone camera photos are often
// 3–8 MB (4000+ px); scaled to 1600 px as JPEG they are ~200–400 KB and still sharp
// enough to see a defect, so saving no longer waits on a multi-megabyte upload.

type Options = { maxDimension?: number; quality?: number; preserveTransparency?: boolean };

/** Returns a smaller JPEG/PNG, or the original file if it isn't an image, can't be decoded, or is already small. */
export async function compressImage(file: File, { maxDimension = 1600, quality = 0.75, preserveTransparency = false }: Options = {}): Promise<File> {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const keepTransparent = preserveTransparency && isPng;

    try {
        const image = await loadImage(file);
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;

        if (!keepTransparent) {
            // White under transparent PNG areas (JPEG has no transparency, they'd turn black)
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(image.source, 0, 0, width, height);
        image.release();

        const mimeType = keepTransparent ? 'image/png' : 'image/jpeg';
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, keepTransparent ? undefined : quality));
        if (!blob || blob.size >= file.size) return file;

        const ext = keepTransparent ? '.png' : '.jpg';
        const name = file.name.replace(/\.[^.]+$/, '') + ext;
        return new File([blob], name, { type: mimeType, lastModified: Date.now() });
    } catch {
        return file; // e.g. a format this browser can't decode: upload as is
    }
}

type LoadedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function loadImage(file: File): Promise<LoadedImage> {
    // createImageBitmap applies the photo's EXIF rotation, so portrait shots stay upright
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
        } catch {
            // Older Safari: fall back to an <img>, which also honours EXIF rotation there
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (err) {
        URL.revokeObjectURL(url);
        throw err;
    }
}
