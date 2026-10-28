// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppFooter } from '../components/AppFooter';
import { CapAlertCenter } from '../components/CapAlertCenter';
import { OfflineSyncStatus } from '../components/OfflineSyncStatus';

// Browser bar colour on phones, matching the navy of the app icon
export const viewport: Viewport = {
  themeColor: '#0e2947',
};

// Icons come from app/icon.png (browser tab) and app/apple-icon.png (iPhone home screen);
// app/manifest.ts names the app and gives Android its icons.
export const metadata: Metadata = {
  title: 'CTQ Audit RQC',
  description: 'Critical To Quality Audit System — Roving Quality Control for Footwear Manufacturing',
  keywords: ['CTQ', 'audit', 'quality control', 'RQC', 'footwear', 'manufacturing'],
  // iOS (Safari and every iPhone browser) turns number-like text such as PO numbers into
  // tel:/date links before React hydrates, which broke hydration on iPhones.
  formatDetection: { telephone: false, date: false, email: false, address: false },
  // "Add to Home Screen" on iPhone: opens full screen under the name "CTQ Audit"
  appleWebApp: { capable: true, title: 'CTQ Audit', statusBarStyle: 'default' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 pb-6 w-full relative">
            {children}
          </main>
          <AppFooter />
          {/* CAP alert popups for everyone with the app open */}
          <CapAlertCenter />
          {/* Offline / not-yet-sent status of the audit data */}
          <OfflineSyncStatus />
        </div>
      </body>
    </html>
  );
}
