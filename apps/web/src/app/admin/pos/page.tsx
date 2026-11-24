'use client';

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ColumnFilter from '../../../components/admin/ColumnFilter';
import SearchInput from '../../../components/admin/SearchInput';
import TablePager from '../../../components/admin/TablePager';
import { EMPTY_LABEL, columnFiltersParam, sortParam, type ColumnFilters, type ColumnFilterSel, type ColumnSort, type FilterOptionsResult, type SortDir, type SortKind } from '../../../lib/column-filters';

type Po = { po: string; article: string; model: string; destination?: string; qtyOrder: number };

// API errors come back as { message: string | string[] }
const readError = async (res: Response, fallback: string) => {
    const body = await res.json().catch(() => null);
    const msg = body?.message;
    return Array.isArray(msg) ? msg.join('\n') : (msg || fallback);
};

export default function PoManagementPage() {
    const [pos, setPos] = useState<Po[]>([]);
    const [loading, setLoading] = useState(true);
    // Search box as typed, applied after a short debounce; header filters (Excel style) apply on OK.
    // 36k+ POs, so the server pages and filters (`cols`, see the API's common/column-filters).
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [cols, setCols] = useState<ColumnFilters>({});
    const [notice, setNotice] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    // Sorted from a column header (the server sorts; newest PO number first without one)
    const [sort, setSort] = useState<ColumnSort>(null);
    const [total, setTotal] = useState(0);
    const [form, setForm] = useState<Partial<Po>>({});
    const [editPo, setEditPo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /** The search box and the header filters as query params */
    const filterParams = (params: URLSearchParams) => {
        if (appliedSearch.trim()) params.set('q', appliedSearch.trim());
        const colsParam = columnFiltersParam(cols);
        if (colsParam) params.set('cols', colsParam);
        return params;
    };

    const fetchPos = async () => {
        setLoading(true);
        try {
            const params = filterParams(new URLSearchParams({ page: String(page), limit: String(pageSize) }));
            if (sort) params.set('sort', sortParam(sort));
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

    // Debounce the search box so the server isn't queried on every keystroke
    useEffect(() => {
        if (search === appliedSearch) return;
        const t = setTimeout(() => { setAppliedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { fetchPos(); }, [page, pageSize, appliedSearch, cols, sort]);

    const changePageSize = (size: number) => { setPageSize(size); setPage(1); };
    const applySort = (key: string, dir: SortDir | null) => { setSort(dir ? { key, dir } : null); setPage(1); };

    const setColumnFilter = (key: string, sel: ColumnFilterSel | null) => {
        setCols(prev => {
            const next = { ...prev };
            if (sel) next[key] = sel; else delete next[key];
            return next;
        });
        setPage(1);
        setNotice('');
    };

    // One column's values (with PO counts) from the server, under the search box and the other header filters
    const loadOptions = (field: string) => async (s: string): Promise<FilterOptionsResult> => {
        const params = filterParams(new URLSearchParams({ field }));
        if (s) params.set('search', s);
        const res = await fetch(`/api/master/pos/filter-options?${params.toString()}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(body?.options)) throw new Error(body?.message || `Gagal memuat nilai (${res.status}).`);
        return {
            options: body.options.map((o: { value: string; count: number }) => ({ value: o.value, label: o.value === '' ? EMPTY_LABEL : o.value, count: o.count })),
            truncated: !!body.truncated,
        };
    };
    const F = (key: string, title: string, sortKind: SortKind = 'text') => (
        <ColumnFilter
            title={title}
            sel={cols[key]}
            serverSearch
            loadOptions={loadOptions(key)}
            onApply={sel => setColumnFilter(key, sel)}
            sort={sort?.key === key ? sort.dir : null}
            onSort={dir => applySort(key, dir)}
            sortKind={sortKind}
        />
    );

    const hasFilters = !!search.trim() || Object.keys(cols).length > 0;
    const resetFilters = () => {
        setSearch('');
        setAppliedSearch('');
        setCols({});
        setPage(1);
        setNotice('');
    };

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

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
        const show: ColumnFilters = { po: { values: [savedPo] } };
        const alreadyShown = !appliedSearch && JSON.stringify(show) === JSON.stringify(cols) && page === 1;
        setSearch('');
        setAppliedSearch('');
        setCols(show);
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
        <div className="admin-page">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="admin-page-title">Purchase Orders</h1>
                    <p className="admin-page-subtitle">Manage PO master data for audit sessions.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleImportFile} />
                    <button onClick={downloadTemplate} className="admin-btn admin-btn-secondary">
                        Download template
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="admin-btn admin-btn-secondary">
                        Import Excel
                    </button>
                    <button onClick={handleDeleteAll} className="admin-btn admin-btn-danger">
                        Clear All POs
                    </button>
                    <button onClick={cancelEdit} className="admin-btn admin-btn-primary">
                        + New PO
                    </button>
                </div>
            </div>

            <div className="admin-toolbar">
                <SearchInput
                    value={search}
                    onChange={v => { setSearch(v); setNotice(''); }}
                    placeholder="Cari PO, article, model, destination..."
                    className="flex-1 min-w-[220px] sm:max-w-md"
                />
                {hasFilters && (
                    <button onClick={resetFilters} className="inline-flex items-center h-9 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        Reset filters
                    </button>
                )}
            </div>

            {/* The form stays beside the table; only the table's rows scroll */}
            <div className="admin-split grid grid-cols-1 lg:grid-cols-3 gap-4 lg:grid-rows-[minmax(0,1fr)] overflow-y-auto lg:overflow-visible">
                {/* Form */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden h-fit lg:max-h-full lg:overflow-y-auto">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-gray-800">{editPo ? `Editing: ${editPo}` : 'New Purchase Order'}</h2>
                        {editPo && <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancel</button>}
                    </div>
                    <form onSubmit={handleSave} className="p-4 space-y-3">
                        <div>
                            <label className="admin-field-label">PO Number</label>
                            <input required type="text" disabled={!!editPo} value={form.po || ''} onChange={e => setForm({ ...form, po: e.target.value.toUpperCase() })} className="admin-input font-mono" />
                        </div>
                        <div>
                            <label className="admin-field-label">Article</label>
                            <input required type="text" value={form.article || ''} onChange={e => setForm({ ...form, article: e.target.value.toUpperCase() })} className="admin-input" />
                        </div>
                        <div>
                            <label className="admin-field-label">Model</label>
                            <input required type="text" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value.toUpperCase() })} className="admin-input" />
                        </div>
                        <div>
                            <label className="admin-field-label">Destination</label>
                            <input type="text" value={form.destination || ''} onChange={e => setForm({ ...form, destination: e.target.value.toUpperCase() })} className="admin-input" />
                        </div>
                        <div>
                            <label className="admin-field-label">Order Qty</label>
                            <input required type="number" min="1" value={form.qtyOrder || ''} onChange={e => setForm({ ...form, qtyOrder: parseInt(e.target.value) })} className="admin-input font-mono" />
                        </div>
                        <button type="submit" className="admin-btn admin-btn-primary w-full">
                            {editPo ? 'Save changes' : 'Create PO'}
                        </button>
                    </form>
                </div>

                {/* Table */}
                <div className="lg:col-span-2 admin-table-card">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-gray-800">
                            Purchase Orders
                            <span className="ml-1.5 text-xs text-gray-400 font-normal">{total.toLocaleString()} records</span>
                        </h2>
                    </div>
                    {notice && (
                        <div className="px-4 py-2 text-xs text-green-800 bg-green-50 border-b border-green-100">{notice}</div>
                    )}
                    {/* Table stays mounted while loading so the filter inputs keep focus */}
                    <div className="admin-table-scroll">
                        <table className="w-full text-sm">
                            <thead className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-2.5 w-32">{F('po', 'PO')}</th>
                                    <th className="text-left px-4 py-2.5">{F('article', 'Article')}</th>
                                    <th className="text-left px-4 py-2.5">{F('model', 'Model')}</th>
                                    <th className="text-left px-4 py-2.5">{F('destination', 'Destination')}</th>
                                    <th className="text-right px-4 py-2.5 w-24">{F('qtyOrder', 'Qty', 'number')}</th>
                                    <th className="text-right px-4 py-2.5 w-24"></th>
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
                    <TablePager
                        page={page}
                        pageSize={pageSize}
                        total={total}
                        onPage={setPage}
                        onPageSize={changePageSize}
                        disabled={loading}
                        noun="PO"
                    />
                </div>
            </div>
        </div>
    );
}
