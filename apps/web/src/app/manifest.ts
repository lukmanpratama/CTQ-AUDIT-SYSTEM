// Web app manifest (served at /manifest.webmanifest): name, icon and colours used when the
// app is added to a phone's home screen, so it opens like an app with the CTQ "Q" icon.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CTQ Audit System',
    short_name: 'CTQ Audit',
    description: 'Critical To Quality Audit System — Roving Quality Control for Footwear Manufacturing',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0e2947', // navy of the logo
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops adaptive icons to a circle/squircle; this one has a wider margin
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
