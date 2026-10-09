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
      <body className="h-full" suppressHydrationWarning>
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 pb-6 w-full relative">
            {children}
          </main>
          <footer className="fixed bottom-0 left-0 w-full z-[9999] bg-white/90 backdrop-blur-md border-t border-gray-200 text-center py-1 flex items-center justify-center">
            <span className="text-[10px] font-extrabold tracking-widest text-[#B0BEC5] uppercase">
              DEVELOP BY QUALITY DIGITAL TEAM @2026
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
