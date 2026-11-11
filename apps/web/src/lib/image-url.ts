/**
 * Converts stored photo URLs (MinIO localhost URLs or keys) to a web-accessible URL
 * through the Next.js API proxy (`/api/files/:key`).
 */
export function processImageUrl(url?: string | null): string {
    if (!url) return '';
    // If it's a blob: or data: URL (e.g. offline camera preview), keep as-is
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;

    // If it's a MinIO URL like http://localhost:9000/ctqaudit/key or http://api:9000/ctqaudit/key
    if (url.includes('/ctqaudit/')) {
        const parts = url.split('/ctqaudit/');
        if (parts.length > 1) return `/api/files/${parts[1]}`;
    }

    // If it's a plain file key without http
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
        return `/api/files/${url}`;
    }

    return url;
}

