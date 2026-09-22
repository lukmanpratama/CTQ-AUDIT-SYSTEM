// apps/web/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CTQ Audit RQC',
  description: 'Critical To Quality Audit System — Roving Quality Control for Footwear Manufacturing',
  keywords: ['CTQ', 'audit', 'quality control', 'RQC', 'footwear', 'manufacturing'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
