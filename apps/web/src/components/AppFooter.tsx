'use client';

import { usePathname } from 'next/navigation';

/** Credit line shown at the bottom of every page. h-8 (2rem): the login and offline pages subtract it from their min-h-screen. */
export function AppFooter({ className = '' }: { className?: string }) {
  return (
    <footer
      className={`h-8 shrink-0 flex items-center justify-center px-4 text-[11px] font-medium tracking-wider text-gray-400 select-none print:hidden ${className}`}
    >
      DEVELOP BY QUALITY DIGITAL TEAM @2026
    </footer>
  );
}

// Layouts that render the footer themselves (inside their own scroll area / above their fixed
// navigation), so the root layout must not add a second one under them.
const OWN_FOOTER_PREFIXES = ['/admin', '/audit', '/dashboard', '/history', '/profile'];

/** Footer for the root layout: every page that is not inside the admin or inspector shell. */
export function RootFooter() {
  const pathname = usePathname() || '';
  if (OWN_FOOTER_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <AppFooter />;
}
