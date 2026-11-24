'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronDown, Filter, FilterX, Loader2, Search } from 'lucide-react';
import type { ColumnFilterSel, FilterOptionsResult, SortDir, SortKind } from '../../lib/column-filters';

const PANEL_WIDTH = 264;
const PANEL_HEIGHT = 450; // about the panel's full height, to keep it inside the window

/** Wording of the two sort buttons, by what the column holds */
const SORT_LABELS: Record<SortKind, [string, string]> = {
    text: ['Urutkan A → Z', 'Urutkan Z → A'],
    number: ['Terkecil → Terbesar', 'Terbesar → Terkecil'],
    date: ['Terlama → Terbaru', 'Terbaru → Terlama'],
};

/** Ticked values while the panel is open: with `exclude`, everything except `set` */
type Draft = { exclude: boolean; set: Set<string> };

/**
 * Excel-style filter in a table header: the column name with a ▾ that opens a panel with the
 * sort buttons (A → Z / Z → A) and a list of the column's values to tick, with search,
 * (Pilih semua), Bersihkan / Batal / OK. A filtered column shows a blue funnel, a sorted one an
 * arrow. The panel is portalled to <body> (position: fixed), so neither the table's scroll box
 * nor the header's uppercase styling reaches it.
 */
export default function ColumnFilter({ title, sel, loadOptions, onApply, sort = null, onSort, sortKind = 'text', iconOnly = false, serverSearch = false }: {
    title: string;
    sel: ColumnFilterSel | null | undefined;
    /** The column's values; called on open, and with serverSearch again as the search changes */
    loadOptions: (search: string) => FilterOptionsResult | Promise<FilterOptionsResult>;
    onApply: (sel: ColumnFilterSel | null) => void;
    /** How the table is sorted by this column, if it is */
    sort?: SortDir | null;
    /** Sorts the table by this column (null clears the sort); without it the panel has no sort buttons */
    onSort?: (dir: SortDir | null) => void;
    sortKind?: SortKind;
    /** Only the ▾ / funnel, for a header whose label does something else */
    iconOnly?: boolean;
    /** The server searches its values (its list stops at a limit); otherwise the loaded list is searched */
    serverSearch?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [search, setSearch] = useState('');
    const [result, setResult] = useState<FilterOptionsResult>({ options: [] });
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [draft, setDraft] = useState<Draft>({ exclude: true, set: new Set() });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const loadRef = useRef(loadOptions);
    loadRef.current = loadOptions;

    const active = !!sel;
    const serverQuery = serverSearch ? search.trim() : '';

    // Values: at once on open; for a server list again after a pause in typing
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const t = setTimeout(async () => {
            setLoading(true);
            setLoadError('');
            try {
                const r = await loadRef.current(serverQuery);
                if (!cancelled) setResult(r);
            } catch (e: any) {
                if (!cancelled) {
                    setResult({ options: [] });
                    setLoadError(e?.message || 'Gagal memuat nilai.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, serverQuery ? 250 : 0);
        return () => { cancelled = true; clearTimeout(t); };
    }, [open, serverQuery]);

    // Close on a click outside, Escape, a scroll elsewhere (the panel is fixed) or a resize
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
        };
        const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) close(); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('scroll', onScroll, true);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('scroll', onScroll, true);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    const q = search.trim().toLowerCase();
    const visible = useMemo(
        () => (q ? result.options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : result.options),
        [result, q],
    );
    const ticked = (v: string) => (draft.exclude ? !draft.set.has(v) : draft.set.has(v));
    const tickedVisible = visible.filter(o => ticked(o.value)).length;
    const allVisible = visible.length > 0 && tickedVisible === visible.length;
    const someVisible = tickedVisible > 0 && !allVisible;

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = someVisible;
    }, [someVisible, open, loading]);

    const openPanel = () => {
        const button = buttonRef.current!;
        const anchor = (button.closest('th') ?? button).getBoundingClientRect();
        const below = button.getBoundingClientRect().bottom + 6;
        setPos({
            left: Math.max(8, Math.min(anchor.left, window.innerWidth - PANEL_WIDTH - 8)),
            top: below + PANEL_HEIGHT > window.innerHeight - 8 ? Math.max(8, window.innerHeight - PANEL_HEIGHT - 8) : below,
        });
        setSearch('');
        setResult({ options: [] });
        setDraft(sel ? { exclude: !!sel.exclude, set: new Set(sel.values) } : { exclude: true, set: new Set() });
        setOpen(true);
    };

    const toggle = (v: string) => setDraft(d => {
        const set = new Set(d.set);
        if (set.has(v)) set.delete(v); else set.add(v);
        return { ...d, set };
    });

    const toggleAll = () => {
        if (!q) {
            setDraft(allVisible ? { exclude: false, set: new Set() } : { exclude: true, set: new Set() });
            return;
        }
        // While searching, only the values found are ticked or unticked
        const want = !allVisible;
        setDraft(d => {
            const set = new Set(d.set);
            for (const o of visible) {
                if (want !== d.exclude) set.add(o.value); else set.delete(o.value);
            }
            return { ...d, set };
        });
    };

    // What OK applies: null = no filter, 'none' = nothing ticked (OK is disabled)
    const pending = (): ColumnFilterSel | null | 'none' => {
        if (q) {
            // Like Excel: OK after a search keeps only the ticked values that were found
            const values = visible.filter(o => ticked(o.value)).map(o => o.value);
            return values.length ? { values } : 'none';
        }
        const complete = !result.truncated && result.options.length > 0;
        if (draft.exclude) {
            if (draft.set.size === 0) return null;
            if (complete && result.options.every(o => draft.set.has(o.value))) return 'none';
            return { values: [...draft.set], exclude: true };
        }
        if (draft.set.size === 0) return 'none';
        if (complete && result.options.every(o => draft.set.has(o.value))) return null;
        return { values: [...draft.set] };
    };
    const next = open ? pending() : null;

    const apply = () => {
        if (next === 'none' || loading) return;
        if (next || sel) onApply(next);
        setOpen(false);
    };

    // Sorting applies at once, like Excel; clicking the active direction again removes the sort
    const sortBy = (dir: SortDir) => {
        onSort?.(sort === dir ? null : dir);
        setOpen(false);
    };
    const [ascLabel, descLabel] = SORT_LABELS[sortKind];
    const sortBtn = (dir: SortDir, label: string, Icon: typeof ArrowUp) => (
        <button
            type="button"
            onClick={() => sortBy(dir)}
            aria-pressed={sort === dir}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left ${sort === dir ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
        >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
        </button>
    );

    const panel = (
        <div
            ref={panelRef}
            role="dialog"
            aria-label={`Filter ${title}`}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_WIDTH }}
            className="z-[60] bg-white border border-gray-200 rounded-lg shadow-xl text-xs text-gray-700 font-normal normal-case tracking-normal text-left"
        >
            {onSort && (
                <div className="p-1.5 border-b border-gray-100">
                    {sortBtn('asc', ascLabel, ArrowUp)}
                    {sortBtn('desc', descLabel, ArrowDown)}
                </div>
            )}
            <div className="px-3 pt-3 pb-2 space-y-2">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{title}</p>
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
                        placeholder="Cari"
                        aria-label={`Cari nilai ${title}`}
                        className="w-full border border-gray-300 rounded-md pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    />
                </div>
            </div>

            <div className="mx-3 border border-gray-200 rounded-md h-56 overflow-y-auto py-1">
                {loading ? (
                    <p className="px-2.5 py-2 text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat...</p>
                ) : loadError ? (
                    <p className="px-2.5 py-2 text-red-600">{loadError}</p>
                ) : visible.length === 0 ? (
                    <p className="px-2.5 py-2 text-gray-400">{q ? 'Tidak ada yang cocok.' : 'Tidak ada nilai.'}</p>
                ) : (
                    <>
                        <label className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer font-semibold text-gray-900">
                            <input ref={selectAllRef} type="checkbox" checked={allVisible} onChange={toggleAll} className="w-3.5 h-3.5 accent-gray-900 flex-shrink-0" />
                            {q ? '(Pilih semua hasil pencarian)' : '(Pilih semua)'}
                        </label>
                        {visible.map(o => (
                            <label key={o.value} className="flex items-center gap-2 px-2.5 py-1 hover:bg-gray-50 cursor-pointer">
                                <input type="checkbox" checked={ticked(o.value)} onChange={() => toggle(o.value)} className="w-3.5 h-3.5 accent-gray-900 flex-shrink-0" />
                                <span className={`flex-1 truncate ${o.value === '' ? 'italic text-gray-400' : ''}`} title={o.label}>{o.label}</span>
                                {o.count !== undefined && <span className="flex-shrink-0 text-[10px] text-gray-400 font-mono">{o.count.toLocaleString()}</span>}
                            </label>
                        ))}
                    </>
                )}
            </div>
            {result.truncated && !loading && (
                <p className="px-3 pt-1.5 text-[11px] text-gray-400">Hanya sebagian nilai yang tampil. Ketik di Cari untuk menemukan yang lain.</p>
            )}

            <div className="flex items-center justify-between px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => { onApply(null); setOpen(false); }}
                    disabled={!active}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                    <FilterX className="w-3.5 h-3.5" />
                    Bersihkan
                </button>
                <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setOpen(false)} className="px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100">
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={apply}
                        disabled={next === 'none' || loading}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => (open ? setOpen(false) : openPanel())}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={iconOnly ? `Filter ${title}` : undefined}
                title={[active ? `${title}: filter aktif` : `Filter ${title}`, sort ? (sort === 'asc' ? 'diurutkan naik' : 'diurutkan turun') : ''].filter(Boolean).join(', ')}
                className={`group inline-flex items-center gap-1 rounded text-left whitespace-nowrap [text-transform:inherit] [letter-spacing:inherit] ${active || sort ? 'text-blue-700' : 'hover:text-gray-900'}`}
            >
                {!iconOnly && <span>{title}</span>}
                {sort && (sort === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" aria-hidden /> : <ArrowDown className="w-3 h-3 flex-shrink-0" aria-hidden />)}
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded flex-shrink-0 ${active ? 'bg-blue-100 text-blue-700' : open ? 'bg-gray-200 text-gray-700' : 'text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-700'}`}>
                    {active ? <Filter className="w-2.5 h-2.5 fill-current" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
            </button>
            {open && createPortal(panel, document.body)}
        </>
    );
}

/** "Hapus filter kolom (n)" link next to a table's row count; hidden while no column is filtered */
export function ClearColumnFilters({ count, onClear }: { count: number; onClear: () => void }) {
    if (!count) return null;
    return (
        <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
            <FilterX className="w-3 h-3" />
            Hapus filter kolom ({count})
        </button>
    );
}
