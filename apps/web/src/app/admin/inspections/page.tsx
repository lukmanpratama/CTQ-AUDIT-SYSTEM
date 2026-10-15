'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RqcImportButton } from '../../../features/rqc/components/RqcImportButton';
import { modelLabel } from '../../../lib/model-label';

export default function AdminInspectionsPage() {
    const [headers, setHeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    const loadHeaders = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterModel) params.append('model', filterModel);
        if (filterInspector) params.append('inspector', filterInspector);
        if (filterCheckingTime) params.append('checkingTime', filterCheckingTime);
        if (filterStartDate) params.append('startDate', filterStartDate);
        if (filterEndDate) params.append('endDate', filterEndDate);
        if (filterFactoryId) params.append('factoryId', filterFactoryId);
        if (filterCell) params.append('cell', filterCell);

        fetch(`/api/rqc/headers?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                // An API error returns an object, not a list; keep the page usable
                if (!Array.isArray(data)) {
                    console.error('Failed to load headers', data);
                    alert(`Failed to load inspection reports: ${data?.message || 'unknown error'}`);
                }
                setHeaders(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load headers', err);
                setLoading(false);
            });
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
    }, [filterModel, filterInspector, filterCheckingTime, filterStartDate, filterEndDate, filterFactoryId, filterCell]);

    const handleDelete = async (headerId: string) => {
        if (!confirm('Apakah anda yakin ingin menghapus report ini? Data inspeksi di dalamnya akan ikut terhapus permanen.')) {
            return;
        }

        try {
            const res = await fetch(`/api/rqc/headers/${headerId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                // Refresh data
                loadHeaders();
                setSelectedIds(prev => prev.filter(id => id !== headerId));
            } else {
                alert('Gagal menghapus report.');
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan.');
        }
    };

    const toggleSelectAll = (modelHeaders: any[]) => {
        const ids = modelHeaders.map((h: any) => h.rqcHeaderId);
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
            await Promise.all(
                selectedIds.map(id => fetch(`/api/rqc/headers/${id}`, { method: 'DELETE' }))
            );
            loadHeaders();
            setSelectedIds([]);
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat menghapus data.');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    // Group headers by Model
    const groupedByModel = headers.reduce((acc: any, h: any) => {
        // Group by the Setup CTQ model (with Model No) so models sharing a name stay apart
        const modelName = modelLabel(h.setupModel) || h.model;
        if (!acc[modelName]) {
            acc[modelName] = [];
        }
        acc[modelName].push(h);
        return acc;
    }, {});

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
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

            {loading ? (
                <div className="py-20 text-center text-gray-400 font-medium animate-pulse">Loading inspection results...</div>
            ) : Object.keys(groupedByModel).length === 0 ? (
                <div className="py-20 text-center text-gray-400">Belum ada inspeksi yang tercatat.</div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedByModel).map(([modelName, modelHeaders]: [string, any]) => (
                        <div key={modelName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
                                <h2 className="font-bold text-gray-800 text-sm tracking-wide">{modelName}</h2>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                    {modelHeaders.length} Reports
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-5 py-3 w-4">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={modelHeaders.length > 0 && modelHeaders.every((h: any) => selectedIds.includes(h.rqcHeaderId))}
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
                                        {modelHeaders.map((h: any) => {
                                            // Quick metric extraction
                                            let checks = 0;
                                            let defects = 0;
                                            h.rqcAreas?.forEach((a: any) => {
                                                a.rqcProcesses?.forEach((p: any) => {
                                                    checks += p.qtyChecking || 0;
                                                    p.rqcInspections?.forEach((i: any) => {
                                                        defects += i.qtyDefect || 0;
                                                    });
                                                });
                                            });

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
                                                                onClick={() => handleDelete(h.rqcHeaderId)}
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
