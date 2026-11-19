'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { clearSession } from '../../lib/session';

type NavItem = { name: string; path: string; icon: string; /** other path prefixes that belong to this item */ also?: string[] };

// Users is a tab of Master Data and Master USP a tab of Setup CTQ; their old URLs redirect there.
const NAV: NavItem[] = [
    { name: 'Dashboard Monitoring', path: '/admin/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { name: 'Master Data', path: '/admin/master', also: ['/admin/users'], icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M9 11h.01M15 11h.01M9 15h.01M15 15h.01' },
    { name: 'Inspection Report', path: '/admin/inspections', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { name: 'Setup CTQ', path: '/admin/setup-ctq', also: ['/admin/setup'], icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { name: 'Setup Defect TQC', path: '/admin/setup-defect-tqc', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
    { name: 'TQC Report', path: '/admin/tqc', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { name: 'Purchase Orders', path: '/admin/pos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

// The exact path or anything below it ("/admin/setup" must not match "/admin/setup-ctq")
const isActive = (pathname: string, item: NavItem) =>
    [item.path, ...(item.also || [])].some(p => pathname === p || pathname.startsWith(`${p}/`));

const COLLAPSED_KEY = 'ctq_admin_sidebar_collapsed';
// Below Tailwind's md breakpoint the sidebar always sits in its mini form; expanding it lays
// it over the page (closing on navigation) instead of squeezing a phone-width screen.
const PHONE_QUERY = '(max-width: 767px)';

// Delay before a mouse resting on the mini sidebar expands it, so passing over the left edge
// on the way to something else doesn't flash it open.
const HOVER_OPEN_DELAY_MS = 150;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [nik, setNik] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [isPhone, setIsPhone] = useState(false);
    const [phoneOpen, setPhoneOpen] = useState(false);
    // Mini sidebar opened by the mouse resting on it: lays over the page until the mouse leaves
    const [hoverOpen, setHoverOpen] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const role = localStorage.getItem('role');
        const storedNik = localStorage.getItem('nik');
        if (role !== 'ADMIN') {
            router.push('/login');
        } else {
            setNik(storedNik || 'Admin');
            setIsAuthorized(true);
        }
    }, [router]);

    useEffect(() => {
        try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1'); } catch { /* storage blocked: start expanded */ }
        const mq = window.matchMedia(PHONE_QUERY);
        const sync = () => { setIsPhone(mq.matches); setPhoneOpen(false); setHoverOpen(false); };
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    // A tap on a menu item closes the expanded phone sidebar
    useEffect(() => { setPhoneOpen(false); }, [pathname]);

    useEffect(() => {
        if (!phoneOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPhoneOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phoneOpen]);

    useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

    const mini = isPhone ? !phoneOpen : collapsed && !hoverOpen;
    // Expanded on top of the page rather than beside it
    const floating = isPhone ? phoneOpen : collapsed && hoverOpen;

    const cancelHoverTimer = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
    };

    // Mouse only: a touch "hover" would open the sidebar under the finger on every tap
    const onPointerEnter = (e: React.PointerEvent) => {
        if (isPhone || !collapsed || e.pointerType !== 'mouse') return;
        cancelHoverTimer();
        hoverTimer.current = setTimeout(() => setHoverOpen(true), HOVER_OPEN_DELAY_MS);
    };
    const onPointerLeave = () => {
        cancelHoverTimer();
        setHoverOpen(false);
    };

    const toggleSidebar = () => {
        cancelHoverTimer();
        setHoverOpen(false);
        if (isPhone) { setPhoneOpen(o => !o); return; }
        setCollapsed(c => {
            const next = !c;
            try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* not remembered */ }
            return next;
        });
    };

    const handleLogout = () => {
        clearSession();
        router.replace('/login');
    };

    if (!isAuthorized) {
        return null;
    }

    // On a phone the button opens / closes the overlay; on a wider screen it pins the sidebar
    // open or back to mini (also while the mouse holds it open)
    const pinned = isPhone ? phoneOpen : !collapsed;
    const toggleLabel = isPhone
        ? (phoneOpen ? 'Tutup sidebar' : 'Buka sidebar')
        : (collapsed ? 'Kunci sidebar terbuka' : 'Ciutkan sidebar');

    return (
        // fixed inset-0: the admin shell fills the window and scrolls only inside <main>.
        // As an in-flow h-screen box under the root layout's bottom padding, the whole page
        // scrolled too, which showed two scrollbars.
        <div className="fixed inset-0 flex bg-gray-100 overflow-hidden">
            {/* Holds the sidebar's place in the row. While mini it stays mini-width, so a sidebar
                expanded by hover (or on a phone) lays over the page instead of pushing it aside. */}
            <div className={`relative flex-shrink-0 transition-[width] duration-200 ${isPhone || collapsed ? 'w-14' : 'w-56'}`}>
                <aside
                    onPointerEnter={onPointerEnter}
                    onPointerLeave={onPointerLeave}
                    className={`absolute inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-[width,box-shadow] duration-200 ${mini ? 'w-14' : 'w-56'} ${floating ? 'shadow-xl' : ''}`}
                >
                    <div className={`h-14 flex-shrink-0 flex items-center border-b border-gray-200 ${mini ? 'justify-center' : 'justify-between pl-5 pr-2'}`}>
                        {!mini && <span className="text-sm font-semibold text-gray-900 tracking-tight whitespace-nowrap">CTQ Audit System</span>}
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            aria-label={toggleLabel}
                            title={toggleLabel}
                            aria-expanded={!mini}
                            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            {pinned ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
                        {NAV.map(item => {
                            const active = isActive(pathname, item);
                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    aria-label={mini ? item.name : undefined}
                                    title={mini ? item.name : undefined}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex items-center gap-2.5 px-3 py-2 mb-0.5 rounded-md text-[13px] whitespace-nowrap transition-colors ${active
                                        ? 'bg-gray-900 text-white font-medium'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                        }`}
                                >
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                                    </svg>
                                    {!mini && <span className="truncate">{item.name}</span>}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-2 border-t border-gray-200 flex-shrink-0">
                        <div className={`flex items-center gap-2.5 mb-1.5 ${mini ? 'justify-center' : 'px-2'}`} title={mini ? `${nik} · Administrator` : undefined}>
                            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                {nik.charAt(0).toUpperCase()}
                            </div>
                            {!mini && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-medium text-gray-800 leading-tight truncate">{nik}</span>
                                    <span className="text-[10px] text-gray-400">Administrator</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            aria-label="Sign out"
                            title={mini ? 'Sign out' : undefined}
                            className={`w-full flex items-center gap-2 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-gray-50 rounded transition-colors ${mini ? 'justify-center' : 'px-3'}`}
                        >
                            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                            {!mini && <span>Sign out</span>}
                        </button>
                    </div>
                </aside>
            </div>

            {isPhone && phoneOpen && (
                <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setPhoneOpen(false)} aria-hidden="true" />
            )}

            <main className="flex-1 min-w-0 flex flex-col bg-gray-50">
                {/* Only the page content scrolls; the footer below stays fixed at the bottom */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
