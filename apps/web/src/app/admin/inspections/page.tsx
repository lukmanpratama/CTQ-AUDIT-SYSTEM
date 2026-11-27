'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RqcImportButton } from '../../../features/rqc/components/RqcImportButton';
import { useDataRefresh } from '../../../lib/use-data-refresh';
import ColumnFilter, { ClearColumnFilters } from '../../../components/admin/ColumnFilter';
import TablePager from '../../../components/admin/TablePager';
import { EMPTY_LABEL, columnFiltersParam, sortParam, type ColumnFilters, type ColumnFilterSel, type ColumnSort, type FilterOptionsResult, type SortDir, type SortKind } from '../../../lib/column-filters';

type HeaderRow = {
    rqcHeaderId: string; date: string; checkingTime: string; po: string; model: string; cell: string | null; nik: string;
    factory: { factory: string } | null; inspector: { namaUser: string } | null; checks: number; defects: number;
    /** Inspection rows above the daily CAP threshold (20%) */
    capCount: number;
};
type ModelGroup = { setupModelId: string; label: string; total: number; page: number; totalPages: number; rows: HeaderRow[] };

/** Text filters wait until typing pauses, instead of hitting the API on every key press. */
function useDebounced<T>(value: T, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export default function AdminInspectionsPage() {
    const [groups, setGroups] = useState<ModelGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState<Record<string, boolean>>({});
    const latestRequest = useRef(0);

    // Filters: date range and model search above the tables; the columns filter from their headers
    // (Excel style, the same for every model's table; the server filters, see the API's common/column-filters)
    const [filterModel, setFilterModel] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [cols, setCols] = useState<ColumnFilters>({});
    // Rows per page in every model's table, and the column header the rows are sorted by (newest first without one)
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState<ColumnSort>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const debouncedModel = useDebounced(filterModel);

    /** Date range, model search and header filters as query params */
    const listParams = (params = new URLSearchParams()) => {
        if (debouncedModel) params.append('model', debouncedModel);
        if (filterStartDate) params.append('startDate', filterStartDate);
        if (filterEndDate) params.append('endDate', filterEndDate);
        const colsParam = columnFiltersParam(cols);
        if (colsParam) params.append('cols', colsParam);
        return params;
    };
    const filterParams = () => {
        const params = listParams(new URLSearchParams({ pageSize: String(pageSize) }));
        if (sort) params.set('sort', sortParam(sort));
        return params;
    };

    const setColumnFilter = (key: string, sel: ColumnFilterSel | null) => setCols(prev => {
        const next = { ...prev };
        if (sel) next[key] = sel; else delete next[key];
        return next;
    });

    // One column's values (with report counts) under the other filters
    const loadOptions = (field: string) => async (search: string): Promise<FilterOptionsResult> => {
        const params = listParams(new URLSearchParams({ field }));
        if (search) params.set('search', search);
        const res = await fetch(`/api/rqc/headers/filter-options?${params.toString()}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(body?.options)) throw new Error(body?.message || `Gagal memuat nilai (${res.status}).`);
        return {
            options: body.options.map((o: { value: string; label?: string; count: number }) => ({
                value: o.value,
                label: o.value === '' ? EMPTY_LABEL : field === 'date' ? formatDate(o.value) : (o.label || o.value),
                count: o.count,
            })),
            truncated: !!body.truncated,
        };
    };
    const applySort = (key: string, dir: SortDir | null) => setSort(dir ? { key, dir } : null);
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

    // Filter-only header (the totals are computed, so these columns cannot be sorted)
    const FD = (key: string, title: string) => (
        <ColumnFilter
            title={title}
            sel={cols[key]}
            serverSearch
            loadOptions={loadOptions(key)}
            onApply={sel => setColumnFilter(key, sel)}
        />
    );

    const fetchGroups = async (params: URLSearchParams): Promise<ModelGroup[]> => {
        const res = await fetch(`/api/rqc/headers/by-model?${params.toString()}`);
        const data = await res.json().catch(() => null);
        // An API error returns an error object, not the groups; keep the page usable
        if (!res.ok || !Array.isArray(data?.groups)) {
            throw new Error(data?.message || `HTTP ${res.status}`);
        }
        return data.groups;
    };

    // Every model with its first page of reports
    const loadHeaders = async () => {
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const data = await fetchGroups(filterParams());
            if (requestId === latestRequest.current) setGroups(data);
        } catch (err: any) {
            console.error('Failed to load headers', err);
            if (requestId === latestRequest.current) alert(`Failed to load inspection reports: ${err?.message || 'unknown error'}`);
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    };

    // One model's table only, at the given page (the server clamps it to the last page)
    const loadGroupPage = async (setupModelId: string, page: number) => {
        const params = filterParams();
        params.set('groupModelId', setupModelId);
        params.set('page', String(page));
        setPageLoading(prev => ({ ...prev, [setupModelId]: true }));
        try {
            const [group] = await fetchGroups(params);
            setGroups(prev => group
                ? prev.map(g => g.setupModelId === setupModelId ? group : g)
                : prev.filter(g => g.setupModelId !== setupModelId));
        } catch (err: any) {
            console.error('Failed to load page', err);
            alert(`Failed to load inspection reports: ${err?.message || 'unknown error'}`);
        } finally {
            setPageLoading(prev => ({ ...prev, [setupModelId]: false }));
        }
    };

    useEffect(() => {
        loadHeaders();
    }, [debouncedModel, filterStartDate, filterEndDate, cols, sort, pageSize]);

    // Someone added / changed data: reload quietly (no loading screen), keeping each
    // model's table on the page it shows and picking up new models / new totals
    const { refreshKey, isBackgroundRefresh } = useDataRefresh();
    const groupsRef = useRef(groups);
    groupsRef.current = groups;
    useEffect(() => {
        if (!isBackgroundRefresh()) return;
        const requestId = ++latestRequest.current;
        (async () => {
            try {
                const fresh = await fetchGroups(filterParams());
                const pageOf = new Map(groupsRef.current.map(g => [g.setupModelId, g.page]));
                const merged = await Promise.all(fresh.map(async g => {
                    const page = pageOf.get(g.setupModelId) || 1;
                    if (page <= 1) return g;
                    const params = filterParams();
                    params.set('groupModelId', g.setupModelId);
                    params.set('page', String(page));
                    const [onPage] = await fetchGroups(params);
                    return onPage || g;
                }));
                if (requestId === latestRequest.current) setGroups(merged);
            } catch (err) {
                console.error('Background refresh failed', err);
            } finally {
                // This request may have replaced a foreground load (e.g. right after an import), which then never clears the loading screen
                if (requestId === latestRequest.current) setLoading(false);
            }
        })();
    }, [refreshKey]);

    const handleDelete = async (headerId: string, group: ModelGroup) => {
        if (!confirm('Apakah anda yakin ingin menghapus report ini? Data inspeksi di dalamnya akan ikut terhapus permanen.')) {
            return;
        }

        try {
            const res = await fetch(`/api/rqc/headers/${headerId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                // Refresh only this model's table, staying on the same page
                loadGroupPage(group.setupModelId, group.page);
                setSelectedIds(prev => prev.filter(id => id !== headerId));
            } else {
                alert('Gagal menghapus report.');
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan.');
        }
    };

    const toggleSelectAll = (modelHeaders: HeaderRow[]) => {
        const ids = modelHeaders.map(h => h.rqcHeaderId);
        const allSelected = ids.every((id: string) => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Apakah anda yakin ingin menghapus ${selectedIds.length} report ini? Data inspeksi di dalamnya akan ikut terhapus permanen.`)) {
            return;
        }

        setIsDeletingBulk(true);
        try {
            // A few at a time: each delete is a DB transaction, firing them all at once floods the API
            for (let i = 0; i < selectedIds.length; i += 5) {
                await Promise.all(
                    selectedIds.slice(i, i + 5).map(id => fetch(`/api/rqc/headers/${id}`, { method: 'DELETE' }))
                );
            }
            loadHeaders();
            setSelectedIds([]);
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat menghapus data.');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="admin-page">
            {/* Title, filters and the bulk-delete bar stay at the top; only the model tables scroll */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="admin-page-title">Inspection Report</h1>
                    <p className="admin-page-subtitle">Daftar laporan inspeksi yang dikelompokkan berdasarkan Model sepatu.</p>
                </div>
                <RqcImportButton onImported={loadHeaders} />
            </div>

            {/* Filters */}
            <div className="admin-toolbar">
                <div className="flex-1 min-w-[150px]">
                    <label className="admin-field-label">Start Date</label>
                    <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="admin-input"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="admin-field-label">End Date</label>
                    <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="admin-input"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="admin-field-label">Model (Search)</label>
                    <input
                        type="text"
                        placeholder="Model name..."
                        value={filterModel}
                        onChange={(e) => setFilterModel(e.target.value)}
                        className="admin-input"
                    />
                </div>
                <div className="flex-[2] min-w-[200px] text-xs text-gray-400 self-center">
                    Time, factory, cell, PO dan inspector difilter dari header kolom tabel.
                    <div className="mt-1"><ClearColumnFilters count={Object.keys(cols).length} onClear={() => setCols({})} /></div>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg flex justify-between items-center transition-all">
                    <span className="text-red-800 text-sm font-semibold">{selectedIds.length} Data report terpilih</span>
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeletingBulk}
                        className="admin-btn bg-red-600 border-red-600 text-white hover:bg-red-700"
                    >
                        {isDeletingBulk ? 'Menghapus...' : 'Hapus Terpilih'}
                    </button>
                </div>
            )}

            <div className="admin-split md:overflow-y-auto space-y-6 md:pr-1">
                {loading ? (
                    <div className="py-20 text-center text-gray-400 font-medium animate-pulse">Loading inspection results...</div>
                ) : groups.length === 0 ? (
                    <div className="py-20 text-center text-gray-400">
                        {Object.keys(cols).length > 0 || filterModel || filterStartDate || filterEndDate
                            ? 'Tidak ada report yang cocok dengan filter.'
                            : 'Belum ada inspeksi yang tercatat.'}
                    </div>
                ) : (
                    groups.map(group => {
                        const modelHeaders = group.rows;
                        return (
                        <div key={group.setupModelId} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
                                <h2 className="font-bold text-gray-800 text-sm tracking-wide">{group.label}</h2>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                    {group.total} Reports
                                </span>
                            </div>

                            {/* The rows scroll inside the card (never taller than 60vh); the column headers stay */}
                            <div className={`admin-table-scroll admin-table-scroll-cap transition-opacity ${pageLoading[group.setupModelId] ? 'opacity-50 pointer-events-none' : ''}`}>
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase border-b">
                                        <tr>
                                            <th className="px-5 py-3 w-4">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={modelHeaders.length > 0 && modelHeaders.every(h => selectedIds.includes(h.rqcHeaderId))}
                                                    onChange={() => toggleSelectAll(modelHeaders)}
                                                />
                                            </th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{F('date', 'Date', 'date')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{F('checkingTime', 'Time')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{F('factory', 'Factory')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{F('cell', 'Cell')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{F('po', 'PO Number')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{F('inspector', 'Inspector')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{FD('checks', 'Checks')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{FD('defects', 'Defects')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{FD('passRate', 'Pass Rate')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{FD('defectRate', 'Defect Rate')}</th>
                                            <th className="px-5 py-3 font-semibold whitespace-nowrap">{FD('status', 'Status')}</th>
                                            <th className="px-5 py-3 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {modelHeaders.map(h => {
                                            // Totals come summed from the API
                                            const { checks, defects } = h;

                                            const defectRate = checks > 0 ? ((defects / checks) * 100) : 0;
                                            const passRate = checks > 0 ? (100 - defectRate) : 0;

                                            const defectRateColor = 'text-red-500 font-bold';
                                            const passRateColor = passRate < 95 ? 'text-orange-500 font-bold' : 'text-green-600 font-bold';

                                            return (
                                                // CAP daily: a report with a defect above 20% is marked red
                                                <tr key={h.rqcHeaderId} className={`transition-colors ${h.capCount > 0 ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : 'hover:bg-gray-50'}`}>
                                                    <td className="px-5 py-3">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            checked={selectedIds.includes(h.rqcHeaderId)}
                                                            onChange={() => toggleSelect(h.rqcHeaderId)}
                                                        />
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-900 font-medium">{formatDate(h.date)}</td>
                                                    <td className="px-5 py-3 text-gray-600">{h.checkingTime}</td>
                                                    <td className="px-5 py-3 text-gray-600">{h.factory?.factory || '-'}</td>
                                                    <td className="px-5 py-3 text-gray-600">{h.cell || '-'}</td>
                                                    <td className="px-5 py-3 text-gray-600">{h.po}</td>
                                                    <td className="px-5 py-3 text-gray-600">{h.inspector?.namaUser || h.nik}</td>
                                                    <td className="px-5 py-3 font-semibold">{checks}</td>
                                                    <td className="px-5 py-3 font-semibold text-red-500">{defects}</td>
                                                    <td className={`px-5 py-3 ${passRateColor}`}>{passRate.toFixed(2)}%</td>
                                                    <td className={`px-5 py-3 ${defectRateColor}`}>
                                                        {defectRate.toFixed(2)}%
                                                        {h.capCount > 0 && (
                                                            <span className="ml-2 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle" title={`${h.capCount} defect di atas 20%`}>
                                                                CAP
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        {h.capCount > 0 ? (
                                                            <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">CAP</span>
                                                        ) : defects > 0 ? (
                                                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Immediate Action</span>
                                                        ) : (
                                                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">No Defect</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-3 text-xs font-medium">
                                                            <Link href={`/admin/inspections/${h.rqcHeaderId}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                                                View
                                                            </Link>
                                                            {/* Opens the RQC edit wizard (header → inspection → summary), returning here afterwards */}
                                                            <Link href={`/admin/inspections/${h.rqcHeaderId}/edit`} className="text-amber-600 hover:text-amber-800 hover:underline">
                                                                Edit
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(h.rqcHeaderId, group)}
                                                                className="text-red-500 hover:text-red-700 hover:underline transition-colors"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <TablePager
                                page={group.page}
                                pageSize={pageSize}
                                total={group.total}
                                onPage={page => loadGroupPage(group.setupModelId, page)}
                                onPageSize={setPageSize}
                                disabled={!!pageLoading[group.setupModelId]}
                                noun="report"
                            />
                        </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
