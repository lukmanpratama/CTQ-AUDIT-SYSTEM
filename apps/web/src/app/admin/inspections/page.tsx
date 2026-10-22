'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RqcImportButton } from '../../../features/rqc/components/RqcImportButton';
import { useDataRefresh } from '../../../lib/use-data-refresh';

const PAGE_SIZE = 10;

type HeaderRow = {
    rqcHeaderId: string; date: string; checkingTime: string; po: string; model: string; cell: string | null; nik: string;
    factory: { factory: string } | null; inspector: { namaUser: string } | null; checks: number; defects: number;
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

    // Filters
    const [filterModel, setFilterModel] = useState('');
    const [filterInspector, setFilterInspector] = useState('');
    const [filterCheckingTime, setFilterCheckingTime] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterFactoryId, setFilterFactoryId] = useState('');
    const [filterCell, setFilterCell] = useState('');

    const [filterOptions, setFilterOptions] = useState({
        factories: [] as any[],
        cells: [] as string[]
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const debouncedModel = useDebounced(filterModel);
    const debouncedInspector = useDebounced(filterInspector);

    const filterParams = () => {
        const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
        if (debouncedModel) params.append('model', debouncedModel);
        if (debouncedInspector) params.append('inspector', debouncedInspector);
        if (filterCheckingTime) params.append('checkingTime', filterCheckingTime);
        if (filterStartDate) params.append('startDate', filterStartDate);
        if (filterEndDate) params.append('endDate', filterEndDate);
        if (filterFactoryId) params.append('factoryId', filterFactoryId);
        if (filterCell) params.append('cell', filterCell);
        return params;
    };

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
        // Load filter options (factory, cell)
        fetch('/api/rqc/filters')
            .then(res => res.json())
            .then(data => setFilterOptions(data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        loadHeaders();
    }, [debouncedModel, debouncedInspector, filterCheckingTime, filterStartDate, filterEndDate, filterFactoryId, filterCell]);

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
        <div className="space-y-6">
            {/* Title, filters and the bulk-delete bar stay at the top while the reports scroll */}
            <div className="admin-sticky-head space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">Inspection Report</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Daftar laporan inspeksi yang dikelompokkan berdasarkan Model sepatu.</p>
                    </div>
                    <RqcImportButton onImported={loadHeaders} />
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Model (Search)</label>
                        <input
                            type="text"
                            placeholder="Model name..."
                            value={filterModel}
                            onChange={(e) => setFilterModel(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Inspector Name</label>
                        <input
                            type="text"
                            placeholder="Inspector..."
                            value={filterInspector}
                            onChange={(e) => setFilterInspector(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Checking Time</label>
                        <select
                            value={filterCheckingTime}
                            onChange={(e) => setFilterCheckingTime(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">All Times</option>
                            <option value="Morning">Morning</option>
                            <option value="Afternoon">Afternoon</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Factory</label>
                        <select
                            value={filterFactoryId}
                            onChange={(e) => setFilterFactoryId(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">All Factories</option>
                            {filterOptions.factories?.map(f => (
                                <option key={f.factoryId} value={f.factoryId}>{f.factory}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Cell</label>
                        <select
                            value={filterCell}
                            onChange={(e) => setFilterCell(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">All Cells</option>
                            {filterOptions.cells?.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedIds.length > 0 && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex justify-between items-center transition-all">
                        <span className="text-red-800 text-sm font-semibold">{selectedIds.length} Data report terpilih</span>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isDeletingBulk ? 'Menghapus...' : 'Hapus Terpilih'}
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-400 font-medium animate-pulse">Loading inspection results...</div>
            ) : groups.length === 0 ? (
                <div className="py-20 text-center text-gray-400">Belum ada inspeksi yang tercatat.</div>
            ) : (
                <div className="space-y-8">
                    {groups.map(group => {
                        const modelHeaders = group.rows;
                        return (
                        <div key={group.setupModelId} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
                                <h2 className="font-bold text-gray-800 text-sm tracking-wide">{group.label}</h2>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                    {group.total} Reports
                                </span>
                            </div>

                            <div className={`overflow-x-auto transition-opacity ${pageLoading[group.setupModelId] ? 'opacity-50 pointer-events-none' : ''}`}>
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-5 py-3 w-4">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={modelHeaders.length > 0 && modelHeaders.every(h => selectedIds.includes(h.rqcHeaderId))}
                                                    onChange={() => toggleSelectAll(modelHeaders)}
                                                />
                                            </th>
                                            <th className="px-5 py-3 font-semibold">Date</th>
                                            <th className="px-5 py-3 font-semibold">Time</th>
                                            <th className="px-5 py-3 font-semibold">Factory</th>
                                            <th className="px-5 py-3 font-semibold">Cell</th>
                                            <th className="px-5 py-3 font-semibold">PO Number</th>
                                            <th className="px-5 py-3 font-semibold">Inspector</th>
                                            <th className="px-5 py-3 font-semibold">Checks</th>
                                            <th className="px-5 py-3 font-semibold">Defects</th>
                                            <th className="px-5 py-3 font-semibold">Pass Rate</th>
                                            <th className="px-5 py-3 font-semibold">Defect Rate</th>
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
                                                <tr key={h.rqcHeaderId} className="hover:bg-gray-50 transition-colors">
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
                                                    <td className={`px-5 py-3 ${defectRateColor}`}>{defectRate.toFixed(2)}%</td>
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
                            <Pagination group={group} pageSize={PAGE_SIZE} onPage={page => loadGroupPage(group.setupModelId, page)} />
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** Footer under each model table: range shown, Prev / page numbers / Next. */
function Pagination({ group, pageSize, onPage }: { group: ModelGroup; pageSize: number; onPage: (page: number) => void }) {
    if (group.totalPages <= 1) return null;
    const { page, totalPages, total } = group;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    // First, last and the pages around the current one; gaps become an ellipsis
    const pages: (number | 'gap')[] = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
        else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
    }

    const btn = 'min-w-[2rem] px-2 py-1 rounded border text-xs font-medium transition-colors';
    const navBtn = `${btn} bg-white border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`;
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Menampilkan {from}–{to} dari {total} report</span>
            <div className="flex items-center gap-1">
                <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={navBtn}>Prev</button>
                {pages.map((p, i) => p === 'gap' ? (
                    <span key={`gap-${i}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPage(p)}
                        className={`${btn} ${p === page ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                        {p}
                    </button>
                ))}
                <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={navBtn}>Next</button>
            </div>
        </div>
    );
}
