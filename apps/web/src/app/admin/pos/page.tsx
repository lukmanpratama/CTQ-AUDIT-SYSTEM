'use client';

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';

type Po = { po: string; article: string; model: string; destination?: string; qtyOrder: number };

const PAGE_SIZE = 100;

type Filters = { q: string; po: string; article: string; model: string; destination: string };
const EMPTY_FILTERS: Filters = { q: '', po: '', article: '', model: '', destination: '' };
type ColumnKey = 'po' | 'article' | 'model' | 'destination';
const COLUMN_FILTERS: { key: ColumnKey; label: string }[] = [
    { key: 'po', label: 'POs' },
    { key: 'article', label: 'Articles' },
    { key: 'model', label: 'Models' },
    { key: 'destination', label: 'Destinations' },
];

/**
 * DataTables-style column filter: "All X ▾" button that opens a searchable list of the column's
 * values (with row counts) from the server, narrowed by the other active filters.
 * The panel is position:fixed so the table's scroll container doesn't clip it.
 */
function ColumnFilterDropdown({ field, label, value, onChange, activeFilters }: {
    field: ColumnKey; label: string; value: string; onChange: (v: string) => void; activeFilters: Filters;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState<{ value: string; count: number }[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const otherFilters = JSON.stringify({ ...activeFilters, [field]: '' });

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(async () => {
            setLoadingOptions(true);
            const params = new URLSearchParams({ field });
            if (search.trim()) params.set('search', search.trim());
            Object.entries(JSON.parse(otherFilters) as Filters).forEach(([k, v]) => { if (v) params.set(k, v); });
            try {
                const body = await fetch(`/api/master/pos/filter-options?${params.toString()}`).then(r => r.json());
                setOptions(body.options || []);
                setTruncated(!!body.truncated);
            } catch {
                setOptions([]);
            } finally {
                setLoadingOptions(false);
            }
        }, search ? 250 : 0);
        return () => clearTimeout(t);
    }, [open, search, field, otherFilters]);

    // Close on outside click, Escape, or when anything else scrolls (the panel is fixed-positioned)
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
        };
        const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) close(); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('scroll', onScroll, true);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('scroll', onScroll, true);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    const toggle = () => {
        if (open) return setOpen(false);
        const rect = buttonRef.current!.getBoundingClientRect();
        setPanelPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)) });
        setSearch('');
        setOpen(true);
    };
    const pick = (v: string) => { onChange(v); setOpen(false); };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                title={value || `All ${label}`}
                className={`w-full flex items-center justify-between gap-1 border rounded px-2 py-1 text-xs font-normal text-left transition-colors ${value ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
                <span className="truncate">{value || `All ${label}`}</span>
                <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && panelPos && (
                <div
                    ref={panelRef}
                    style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, width: 288 }}
                    className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg text-xs font-normal text-left"
                >
                    <div className="p-2 border-b border-gray-100">
                        <input
                            autoFocus
                            type="text"
                            placeholder={`Search ${label.toLowerCase()}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                        <button
                            type="button"
                            onClick={() => pick('')}
                            className={`w-full px-3 py-1.5 text-left hover:bg-gray-50 ${!value ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                        >
                            All {label}
                        </button>
                        {loadingOptions && <div className="px-3 py-2 text-gray-400">Loading...</div>}
                        {!loadingOptions && options.length === 0 && <div className="px-3 py-2 text-gray-400">No values found.</div>}
                        {!loadingOptions && options.map(o => (
                            <button
                                type="button"
                                key={o.value}
                                onClick={() => pick(o.value)}
                                className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-gray-50 ${o.value === value ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-gray-700'}`}
                            >
                                <span className="truncate" title={o.value}>{o.value}</span>
                                <span className="flex-shrink-0 text-gray-400 font-mono">{o.count.toLocaleString()}</span>
                            </button>
                        ))}
                    </div>
                    {truncated && !loadingOptions && (
                        <div className="px-3 py-1.5 border-t border-gray-100 text-[11px] text-gray-400">Showing the first 200 values. Type to search.</div>
                    )}
                </div>
            )}
        </>
    );
}

// API errors come back as { message: string | string[] }
const readError = async (res: Response, fallback: string) => {
    const body = await res.json().catch(() => null);
    const msg = body?.message;
    return Array.isArray(msg) ? msg.join('\n') : (msg || fallback);
};

export default function PoManagementPage() {
    const [pos, setPos] = useState<Po[]>([]);
    const [loading, setLoading] = useState(true);
    // Search box (q) + column filters, as typed; applied after a short debounce
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
    const [notice, setNotice] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [form, setForm] = useState<Partial<Po>>({});
    const [editPo, setEditPo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPos = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
            if (appliedFilters.q.trim()) params.set('q', appliedFilters.q.trim());
            // Column filters are exact values from the dropdown: send as-is (trim() would strip
            // the non-breaking spaces some imported names contain and break the match)
            COLUMN_FILTERS.forEach(({ key }) => { if (appliedFilters[key]) params.set(key, appliedFilters[key]); });
            const res = await fetch(`/api/master/pos/paged?${params.toString()}`);
            const result = await res.json();
            setPos(result.data || []);
            setTotal(result.total || 0);
        } catch (e) {
            console.error('Error fetching POs:', e);
            setPos([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search and filters so the server isn't queried on every keystroke
    useEffect(() => {
        if (JSON.stringify(filters) === JSON.stringify(appliedFilters)) return;
        const t = setTimeout(() => { setAppliedFilters(filters); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [filters]);

    useEffect(() => { fetchPos(); }, [page, appliedFilters]);

    const setFilter = (key: keyof Filters, value: string) => setFilters(f => ({ ...f, [key]: value }));
    const hasFilters = Object.values(filters).some(v => v.trim());

    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

    // If rows were deleted and the current page no longer exists, step back to the last page
    useEffect(() => {
        if (!loading && page > totalPages) setPage(totalPages);
    }, [loading, page, totalPages]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = Number(String(form.qtyOrder || '0').replace(/\./g, '').replace(/,/g, ''));
        if (isNaN(qty) || qty < 1) return alert('Order Qty must be a valid positive number.');
        // Only the editable fields: the API rejects unknown properties (sending `po` on update made every edit fail)
        const body = {
            article: (form.article || '').trim(),
            model: (form.model || '').trim(),
            destination: (form.destination || '').trim(),
            qtyOrder: qty,
        };
        const savedPo = editPo || (form.po || '').trim();
        try {
            const res = editPo
                ? await fetch(`/api/master/pos/${encodeURIComponent(editPo)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                : await fetch('/api/master/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, po: savedPo }) });
            if (!res.ok) {
                alert(`${editPo ? 'Update' : 'Create'} PO failed:\n${await readError(res, `HTTP ${res.status}`)}`);
                return;
            }
        } catch (err) {
            alert('Network error: the PO was not saved.');
            return;
        }
        setEditPo(null);
        setForm({});
        // Show the saved PO: with 36k+ POs sorted by number it would otherwise sit on a later page
        setNotice(`PO ${savedPo} ${editPo ? 'updated' : 'created'}.`);
        const show = { ...EMPTY_FILTERS, po: savedPo };
        const alreadyShown = JSON.stringify(show) === JSON.stringify(appliedFilters) && page === 1;
        setFilters(show);
        setAppliedFilters(show);
        setPage(1);
        if (alreadyShown) fetchPos(); // state didn't change, so the fetch effect won't re-run
    };

    const handleDelete = async (po: string) => {
        if (!confirm('Delete this PO? Existing audits linked to it may lose context.')) return;
        const res = await fetch(`/api/master/pos/${encodeURIComponent(po)}`, { method: 'DELETE' });
        if (!res.ok) alert('Cannot delete: this PO is already referenced by an Audit Session.');
        fetchPos();
    };

    const handleDeleteAll = async () => {
        if (!confirm('WARNING: Are you sure you want to DELETE ALL Purchase Orders? This action cannot be undone and may damage existing RQC Audit links.')) return;

        try {
            const res = await fetch('/api/master/pos', { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(`Operation failed: ${data.message || 'Some POs are actively being used in reports and cannot be deleted.'}`);
            } else {
                alert('All Purchase Orders have been cleared successfully.');
                if (page !== 1) setPage(1); else fetchPos();
            }
        } catch (error) {
            alert('Failed to clear Purchase Orders.');
        }
    };

    const downloadTemplate = () => {
        const sampleData = [
            { PO: '0902661124', ARTICLE: 'KI1672', MODEL: 'GALAXY 8 J', DESTINATION: 'U.S.A', 'ORDER QTY': 7 },
            { PO: '0902629311', ARTICLE: 'IE8794', MODEL: 'ULTRARUN 5', DESTINATION: 'ADIDAS INTL TRADING AG Lager', 'ORDER QTY': 553 },
            { PO: '0902772246', ARTICLE: 'IH9795', MODEL: 'GALAXY 8 W', DESTINATION: 'A.ARGENTINA S.A.', 'ORDER QTY': 674 },
            { PO: '0902777039', ARTICLE: 'IH9808', MODEL: 'GALAXY 8 M', DESTINATION: 'A.I.TR. WEST', 'ORDER QTY': 342 },
            { PO: '0902770032', ARTICLE: 'IH9823', MODEL: 'QUESTAR 4 W', DESTINATION: 'A.ARGENTINA S.A.', 'ORDER QTY': 1000 },
            { PO: '0902770129', ARTICLE: 'IH9829', MODEL: 'RUNFALCON 5 TR', DESTINATION: 'A.ARGENTINA S.A.', 'ORDER QTY': 887 },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 35 }, { wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PO_DATA');
        XLSX.writeFile(wb, 'PO_IMPORT_TEMPLATE.xlsx');
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                if (jsonRows.length === 0) return alert('File is empty or unreadable.');

                const mapHeader = (row: any, keys: string[]): string => {
                    for (const k of Object.keys(row)) {
                        const kLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        for (const target of keys) { if (kLower.includes(target)) return row[k]?.toString().trim() || ''; }
                    }
                    return '';
                };

                const dataToUpload: Po[] = [];
                for (const row of jsonRows) {
                    const po = mapHeader(row, ['po']);
                    if (!po) continue;
                    const qtyRaw = mapHeader(row, ['orderqty', 'qty', 'quantity']);
                    dataToUpload.push({
                        po,
                        article: mapHeader(row, ['article', 'art']) || '-',
                        model: mapHeader(row, ['model', 'mdl']) || '-',
                        destination: mapHeader(row, ['destination', 'dest']) || '-',
                        qtyOrder: parseInt(qtyRaw.replace(/\./g, '').replace(/,/g, '')) || 0
                    });
                }

                if (dataToUpload.length === 0) return alert('No valid rows found. Ensure headers include: PO, ARTICLE, MODEL, DESTINATION, ORDER QTY.');

                // Batch the requests on the client side to avoid Next.js API proxy payload limits (which throw 500 Internal Server Error text)
                const chunkSize = 100;
                const totalBatches = Math.ceil(dataToUpload.length / chunkSize);

                for (let i = 0; i < totalBatches; i++) {
                    const chunk = dataToUpload.slice(i * chunkSize, (i + 1) * chunkSize);
                    const res = await fetch('/api/master/pos/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chunk)
                    });

                    if (!res.ok) {
                        let errMessage = `Import failed at batch ${i + 1} of ${totalBatches}.`;
                        try {
                            const err = await res.json();
                            errMessage = err.message || errMessage;
                        } catch (e) {
                            errMessage += ' The server proxy connection aborted due to a payload or connection crash.';
                        }
                        throw new Error(errMessage);
                    }
                }

                alert(`Imported ${dataToUpload.length} purchase orders successfully in ${totalBatches} batches.`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchPos();
            } catch (err: any) {
                alert(`Import failed: ${err.message || 'Unknown error'}`);
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const cancelEdit = () => { setEditPo(null); setForm({}); };
    const displayedPos = pos;

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900">Purchase Orders</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage PO master data for audit sessions.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search PO, article, model, destination..."
                        className="border border-gray-200 rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:border-gray-400 transition-colors"
                        value={filters.q}
                        onChange={e => { setFilter('q', e.target.value); setNotice(''); }}
                    />
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleImportFile} />
                    <button onClick={downloadTemplate} className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors">
                        Download template
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors">
                        Import Excel
                    </button>
                    <button onClick={handleDeleteAll} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                        Clear All POs
                    </button>
                    <button onClick={cancelEdit} className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                        + New PO
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Form */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-fit">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-gray-800">{editPo ? `Editing: ${editPo}` : 'New Purchase Order'}</h2>
                        {editPo && <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancel</button>}
                    </div>
                    <form onSubmit={handleSave} className="p-4 space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">PO Number</label>
                            <input required type="text" disabled={!!editPo} value={form.po || ''} onChange={e => setForm({ ...form, po: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Article</label>
                            <input required type="text" value={form.article || ''} onChange={e => setForm({ ...form, article: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Model</label>
                            <input required type="text" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Destination</label>
                            <input type="text" value={form.destination || ''} onChange={e => setForm({ ...form, destination: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Order Qty</label>
                            <input required type="number" min="1" value={form.qtyOrder || ''} onChange={e => setForm({ ...form, qtyOrder: parseInt(e.target.value) })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <button type="submit" className="w-full bg-gray-900 text-white py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                            {editPo ? 'Save changes' : 'Create PO'}
                        </button>
                    </form>
                </div>

                {/* Table */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-gray-800">
                            Purchase Orders
                            <span className="ml-1.5 text-xs text-gray-400 font-normal">{total.toLocaleString()} records</span>
                        </h2>
                        {hasFilters && (
                            <button
                                onClick={() => { setFilters(EMPTY_FILTERS); setNotice(''); }}
                                className="text-xs text-gray-500 hover:text-gray-800 underline"
                            >
                                Reset filters
                            </button>
                        )}
                    </div>
                    {notice && (
                        <div className="px-4 py-2 text-xs text-green-800 bg-green-50 border-b border-green-100">{notice}</div>
                    )}
                    {/* Table stays mounted while loading so the filter inputs keep focus */}
                    <div className="overflow-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-32">PO</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Article</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Model</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Destination</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 w-20">Qty</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 w-24"></th>
                                    </tr>
                                    <tr>
                                        {COLUMN_FILTERS.map(c => (
                                            <th key={c.key} className="px-3 pb-2 font-normal max-w-[220px]">
                                                <ColumnFilterDropdown
                                                    field={c.key}
                                                    label={c.label}
                                                    value={filters[c.key]}
                                                    activeFilters={appliedFilters}
                                                    onChange={v => {
                                                        // Apply immediately (no debounce needed for a picked value)
                                                        const next = { ...filters, [c.key]: v };
                                                        setFilters(next);
                                                        setAppliedFilters(next);
                                                        setPage(1);
                                                        setNotice('');
                                                    }}
                                                />
                                            </th>
                                        ))}
                                        <th></th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td>
                                        </tr>
                                    )}
                                    {!loading && displayedPos.map(p => (
                                        <tr key={p.po} className={`border-b border-gray-50 transition-colors ${editPo === p.po ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{p.po}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{p.article}</td>
                                            <td className="px-4 py-2.5 text-gray-800 font-medium">{p.model}</td>
                                            <td className="px-4 py-2.5 text-gray-500 max-w-[180px] truncate" title={p.destination || '-'}>{p.destination || '-'}</td>
                                            <td className="px-4 py-2.5 text-right font-mono text-gray-700">{p.qtyOrder.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="inline-flex gap-1">
                                                    <button onClick={() => { setEditPo(p.po); setForm(p); }} className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">Edit</button>
                                                    <button onClick={() => handleDelete(p.po)} className="px-2 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && displayedPos.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                                                {hasFilters
                                                    ? 'No purchase orders match the search / filters.'
                                                    : <>No purchase orders found. Use &quot;Import Excel&quot; to upload from your datasheet.</>}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>
                            {total === 0
                                ? 'Showing 0 results'
                                : <>Showing <span className="font-medium text-gray-700">{((page - 1) * PAGE_SIZE + 1).toLocaleString()}</span> to <span className="font-medium text-gray-700">{Math.min(page * PAGE_SIZE, total).toLocaleString()}</span> of <span className="font-medium text-gray-700">{total.toLocaleString()}</span> results</>}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(p - 1, 1))}
                                disabled={loading || page <= 1}
                                className="border border-gray-200 px-3 py-1 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <span>Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                                disabled={loading || page >= totalPages}
                                className="border border-gray-200 px-3 py-1 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
