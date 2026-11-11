'use client';

/**
 * Header + bottom navigation shared by every inspector page (dashboard, history, profile and the
 * whole audit wizard). Pages put their own bits into the header / above the nav through slots:
 *   <ShellSlot name="search">…</ShellSlot>  left of the header (default: the app title)
 *   <ShellSlot name="filter">…</ShellSlot>  filter button, left of refresh (use <HeaderFilter>)
 *   <ShellSlot name="fab">…</ShellSlot>     floating action button above the nav
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Filter, History, Home, RotateCw, Settings, User, X } from 'lucide-react';
import { clearSession, getSession } from '../../lib/session';
import { pendingCount } from '../../lib/offline/inspection-repository';
import { triggerRefresh } from '../../lib/use-data-refresh';
import { getListOrigin, setListOrigin } from '../../lib/nav-origin';

type SlotName = 'search' | 'filter' | 'fab';

type ShellContextValue = {
    els: Record<SlotName, HTMLElement | null>;
    used: Record<SlotName, boolean>;
    setUsed: (name: SlotName, value: boolean) => void;
    nik: string;
    namaUser: string;
    unsentCount: number;
    isRefreshing: boolean;
    refresh: () => void;
    logout: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

/** The signed-in user, sync status and refresh / logout actions (for the Profile page). */
export function useShell() {
    const ctx = useContext(ShellContext);
    if (!ctx) throw new Error('useShell must be used inside <InspectorShell>');
    return ctx;
}

export function ShellSlot({ name, children }: { name: SlotName; children: ReactNode }) {
    const ctx = useContext(ShellContext);
    const setUsed = ctx?.setUsed;
    useEffect(() => {
        setUsed?.(name, true);
        return () => setUsed?.(name, false);
    }, [name, setUsed]);
    const el = ctx?.els[name];
    return el ? createPortal(children, el) : null;
}

/** Back button in the header, named after where it goes ("< Inspection Report"). Replaces the default "< Home". */
export function ShellBack({ label, onClick }: { label: string; onClick: () => void }) {
    if (!label) return null;
    return (
        <ShellSlot name="search">
            <button onClick={onClick} className="flex items-center -ml-1 pr-2 py-1 font-semibold text-sm text-white hover:text-[#F5A623] transition-colors max-w-full">
                <ChevronLeft className="w-5 h-5 shrink-0" /> <span className="truncate">{label}</span>
            </button>
        </ShellSlot>
    );
}

/**
 * Filter button for the header with a count badge of the active filters and a dropdown panel.
 * `children` is the panel content.
 */
export function HeaderFilter({ count, title, onReset, children }: {
    count: number;
    title: string;
    onReset?: () => void;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className={`relative p-2 rounded-xl border transition-colors ${
                    open || count > 0
                        ? 'bg-[#091E35] border-[#F5A623] text-[#F5A623]'
                        : 'bg-transparent border-transparent text-slate-300 hover:text-white'
                }`}
                title="Filter"
                aria-label={count > 0 ? `Filter, ${count} aktif` : 'Filter'}
            >
                <Filter className="w-5 h-5" />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1.2rem] h-[1.2rem] px-1 bg-[#F5A623] text-[#0E2947] text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-[#0E2947]">
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-[#091E35] border border-[#1A3A60] rounded-2xl shadow-2xl p-4 z-50">
                        <div className="flex items-center justify-between pb-3 border-b border-[#1A3A60] mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</span>
                            {onReset && (
                                <button onClick={onReset} className="text-xs text-[#F5A623] hover:underline">Reset</button>
                            )}
                        </div>
                        {children}
                    </div>
                </>
            )}
        </div>
    );
}

const NAV = [
    { href: '/dashboard', label: 'Home', Icon: Home },
    { href: '/history', label: 'History', Icon: History },
    { href: '/profile', label: 'Profile', Icon: User },
] as const;

export function InspectorShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() || '';

    const [els, setEls] = useState<Record<SlotName, HTMLElement | null>>({ search: null, filter: null, fab: null });
    const [used, setUsedState] = useState<Record<SlotName, boolean>>({ search: false, filter: false, fab: false });
    // Stable callback refs: an inline ref changes every render, so React re-calls it (null, then the element) and setState loops
    const searchRef = useCallback((el: HTMLElement | null) => setEls(p => (p.search === el ? p : { ...p, search: el })), []);
    const filterRef = useCallback((el: HTMLElement | null) => setEls(p => (p.filter === el ? p : { ...p, filter: el })), []);
    const fabRef = useCallback((el: HTMLElement | null) => setEls(p => (p.fab === el ? p : { ...p, fab: el })), []);
    const setUsed = useCallback((name: SlotName, value: boolean) => {
        setUsedState(prev => (prev[name] === value ? prev : { ...prev, [name]: value }));
    }, []);

    const [nik, setNik] = useState('');
    const [namaUser, setNamaUser] = useState('');
    const [unsentCount, setUnsentCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    // Admins edit reports through the audit pages inside their own layout (?source=admin): no inspector chrome there
    const [adminView, setAdminView] = useState(false);
    const [fromHistory, setFromHistory] = useState(false);

    useEffect(() => {
        setAdminView(new URLSearchParams(window.location.search).get('source') === 'admin');
    }, [pathname]);

    // Home and a model's Inspection Report start a new trail; audits opened from History keep History highlighted
    useEffect(() => {
        if (pathname === '/dashboard' || /^\/audit\/[^/]+\/history$/.test(pathname)) setListOrigin(null);
        setFromHistory(getListOrigin() === 'history');
    }, [pathname]);

    useEffect(() => {
        const s = getSession();
        if (s) { setNik(s.nik); setNamaUser(s.namaUser); }
    }, []);

    const refreshPending = useCallback(() => {
        pendingCount().then(setUnsentCount).catch(() => setUnsentCount(0));
    }, []);
    useEffect(() => { refreshPending(); }, [pathname, refreshPending]);

    const refresh = useCallback(() => {
        setIsRefreshing(true);
        triggerRefresh();
        refreshPending();
        setTimeout(() => setIsRefreshing(false), 600);
    }, [refreshPending]);

    const logout = useCallback(async () => {
        const pending = await pendingCount();
        if (pending > 0 && !confirm(`${pending} perubahan belum terkirim ke server. Data tetap tersimpan di perangkat ini dan dikirim otomatis saat online. Tetap logout?`)) {
            return;
        }
        clearSession();
        router.replace('/login');
    }, [router]);

    const ctx: ShellContextValue = { els, used, setUsed, nik, namaUser, unsentCount, isRefreshing, refresh, logout };

    if (adminView) return <>{children}</>;

    const activeHref = pathname.startsWith('/history') || (pathname.startsWith('/audit') && fromHistory) ? '/history' : pathname.startsWith('/profile') ? '/profile' : '/dashboard';

    return (
        <ShellContext.Provider value={ctx}>
            {/* ===== Fixed top header ===== */}
            <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#0E2947] text-white px-4 border-b border-[#1A3A60] shadow-md">
                <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 max-w-md flex items-center">
                        <div ref={searchRef} className="w-full empty:hidden" />
                        {!used.search && (
                            <Link href="/dashboard" className="flex items-center -ml-1 pr-2 py-1 font-semibold text-sm text-white hover:text-[#F5A623] transition-colors">
                                <ChevronLeft className="w-5 h-5" /> Home
                            </Link>
                        )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <div ref={filterRef} className="empty:hidden" />
                        <button
                            onClick={refresh}
                            disabled={isRefreshing}
                            className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                            title="Refresh"
                            aria-label="Refresh"
                        >
                            <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-[#F5A623]' : ''}`} />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors"
                            title="Settings & Profile"
                            aria-label="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Pages sit between the header (3.5rem) and the nav (4rem) */}
            <div className="pt-14 pb-16">{children}</div>

            {/* Floating action button of the page, above the nav */}
            <div
                ref={fabRef}
                className="fixed right-4 bottom-20 z-40 empty:hidden"
                style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            />

            {/* ===== Fixed bottom navigation ===== */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E2947] border-t border-[#1A3A60] shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="w-full max-w-md mx-auto grid grid-cols-3 h-16 px-2">
                    {NAV.map(({ href, label, Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex flex-col items-center justify-center transition-colors ${
                                activeHref === href ? 'text-[#F5A623]' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <Icon className="w-6 h-6 mb-0.5" />
                            <span className="text-[11px] font-semibold tracking-wide">{label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* ===== Settings modal ===== */}
            {showSettings && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                    <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-gray-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#0E2947] text-white p-5 flex items-center justify-between border-b border-[#1A3A60]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#F5A623] text-[#0E2947] flex items-center justify-center font-black text-lg">
                                    {namaUser ? namaUser.charAt(0).toUpperCase() : 'R'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-tight text-white">{namaUser || 'Inspector'}</h3>
                                    <p className="text-xs text-blue-200/70 font-mono mt-0.5">NIK: {nik}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-1 rounded-full transition-colors" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Role</span>
                                    <span className="font-semibold text-gray-800">RQC Inspector</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Offline Pending</span>
                                    <span className={`font-semibold ${unsentCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                        {unsentCount > 0 ? `${unsentCount} perubahan belum sync` : 'Tersinkronisasi'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => { refresh(); setShowSettings(false); }}
                                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <RotateCw className="w-4 h-4 text-[#F5A623]" /> Refresh Master Data
                            </button>
                            <button onClick={logout} className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ShellContext.Provider>
    );
}
