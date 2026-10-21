// apps/web/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AppFooter } from '../components/AppFooter';

export const metadata: Metadata = {
  title: 'CTQ Audit RQC',
  description: 'Critical To Quality Audit System — Roving Quality Control for Footwear Manufacturing',
  keywords: ['CTQ', 'audit', 'quality control', 'RQC', 'footwear', 'manufacturing'],
  // iOS (Safari and every iPhone browser) turns number-like text such as PO numbers into
  // tel:/date links before React hydrates, which broke hydration on iPhones.
  formatDetection: { telephone: false, date: false, email: false, address: false },
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
        </div>
      </body>
    </html>
  );
}
