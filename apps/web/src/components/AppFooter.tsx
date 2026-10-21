'use client';

import { usePathname } from 'next/navigation';

/**
 * Site-wide footer pinned to the bottom of the screen.
 * The admin area has its own footer inside its layout, so this one is hidden there
 * (both used to show at once).
 */
export function AppFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="fixed bottom-0 left-0 w-full z-[9999] bg-white/90 backdrop-blur-md border-t border-gray-200 text-center py-1 flex items-center justify-center">
      <span className="text-[10px] font-extrabold tracking-widest text-[#B0BEC5] uppercase">
        DEVELOP BY QUALITY DIGITAL TEAM @2026
      </span>
    </footer>
  );
}
