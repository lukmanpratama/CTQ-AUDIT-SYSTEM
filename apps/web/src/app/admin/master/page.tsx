'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, X, ArrowUpDown, Plus, Edit2, Trash2, RotateCcw, Filter } from 'lucide-react';

type MasterTab = 'AREAS' | 'PROCESSES' | 'DEFECTS';
type SortOption = 'id-asc' | 'id-desc' | 'name-asc' | 'name-desc';

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState<MasterTab>('AREAS');
    const [areas, setAreas] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);
    const [defects, setDefects] = useState<any[]>([]);
    const [newItem, setNewItem] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('id-asc');
    const [selectedLetter, setSelectedLetter] = useState<string>('ALL');

    // Fetch all 3 collections on mount to show counts on tabs immediately
    useEffect(() => {
        fetchAllMasterData();
    }, []);

    // Reset local filters when switching tab
    useEffect(() => {
        setSearchQuery('');
        setSelectedLetter('ALL');
        setNewItem('');
        setErrorMsg('');
    }, [activeTab]);

    const fetchAllMasterData = async () => {
        try {
            const [areasData, processesData, defectsData] = await Promise.all([
                fetch('/api/master/areas').then(r => r.json()).catch(() => []),
                fetch('/api/master/processes').then(r => r.json()).catch(() => []),
                fetch('/api/master/defects').then(r => r.json()).catch(() => []),
            ]);
            setAreas(Array.isArray(areasData) ? areasData : []);
            setProcesses(Array.isArray(processesData) ? processesData : []);
            setDefects(Array.isArray(defectsData) ? defectsData : []);
        } catch (e) {
            console.error('Error fetching master data:', e);
        }
    };

    const fetchActiveData = async () => {
        try {
            const endpoint = activeTab.toLowerCase();
            const res = await fetch(`/api/master/${endpoint}`);
            const data = await res.json().catch(() => []);
            const arr = Array.isArray(data) ? data : [];
            if (activeTab === 'AREAS') setAreas(arr);
            else if (activeTab === 'PROCESSES') setProcesses(arr);
            else if (activeTab === 'DEFECTS') setDefects(arr);
        } catch (e) {
            console.error('Error fetching active data', e);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        setErrorMsg('');
        setIsSubmitting(true);
        try {
            const endpoint = activeTab.toLowerCase();
            const fieldName = activeTab === 'AREAS' ? 'area' : activeTab === 'PROCESSES' ? 'process' : 'defect';
            const res = await fetch(`/api/master/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [fieldName]: newItem.trim().toUpperCase() })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setErrorMsg(data.message || `Failed to add ${tabLabel.toLowerCase()}.`);
            } else {
                setNewItem('');
                fetchActiveData();
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error occurred while saving.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = async (id: string, oldValue: string) => {
        const newValue = window.prompt(`Edit ${tabLabel}:`, oldValue);
        if (!newValue || newValue.trim() === oldValue) return;
        setErrorMsg('');
        try {
            const endpoint = activeTab.toLowerCase();
            const fieldName = activeTab === 'AREAS' ? 'area' : activeTab === 'PROCESSES' ? 'process' : 'defect';
            const res = await fetch(`/api/master/${endpoint}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [fieldName]: newValue.trim().toUpperCase() })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setErrorMsg(data.message || 'Failed to update.');
            }
            fetchActiveData();
        } catch (err: any) {
            setErrorMsg(err.message || 'Error occurred while updating.');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete "${name}" (ID: ${id})?\nWarning: This may fail if referenced by existing CTQ configurations.`)) {
            return;
        }
        setErrorMsg('');
        try {
            const res = await fetch(`/api/master/${activeTab.toLowerCase()}/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.text().then(t => t ? JSON.parse(t) : {});
                setErrorMsg(data.message || 'Cannot delete — item is in use within CTQ configurations.');
            } else {
                fetchActiveData();
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error occurred while deleting.');
        }
    };

    const tabLabel = activeTab === 'AREAS' ? 'Area' : activeTab === 'PROCESSES' ? 'Process' : 'Defect';
    const currentData = activeTab === 'AREAS' ? areas : activeTab === 'PROCESSES' ? processes : defects;

    const getRow = (item: any) => {
        if (activeTab === 'AREAS') return { id: item.areaId, name: item.area || '' };
        if (activeTab === 'PROCESSES') return { id: item.processId, name: item.process || '' };
        return { id: item.defectId, name: item.defect || '' };
    };

    // Extract unique initial letters for quick filter
    const availableLetters = useMemo(() => {
        const letters = new Set<string>();
        currentData.forEach(item => {
            const row = getRow(item);
            const firstChar = String(row.name).trim().charAt(0).toUpperCase();
            if (firstChar >= 'A' && firstChar <= 'Z') {
                letters.add(firstChar);
            }
        });
        return Array.from(letters).sort();
    }, [currentData, activeTab]);

    // Filter and Sort Data
    const filteredAndSorted = useMemo(() => {
        let list = currentData.map(item => ({
            raw: item,
            row: getRow(item),
        }));

        // Search Filter (ID or Name)
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(item => {
                const idStr = String(item.row.id || '').toLowerCase();
                const nameStr = String(item.row.name || '').toLowerCase();
                return idStr.includes(q) || nameStr.includes(q);
            });
        }

        // Letter Filter
        if (selectedLetter !== 'ALL') {
            list = list.filter(item => {
                const firstChar = String(item.row.name).trim().charAt(0).toUpperCase();
                return firstChar === selectedLetter;
            });
        }

        // Sorting
        list.sort((a, b) => {
            if (sortBy === 'id-asc') return Number(a.row.id) - Number(b.row.id);
            if (sortBy === 'id-desc') return Number(b.row.id) - Number(a.row.id);
            if (sortBy === 'name-asc') return String(a.row.name).localeCompare(String(b.row.name));
            if (sortBy === 'name-desc') return String(b.row.name).localeCompare(String(a.row.name));
            return 0;
        });

        return list;
    }, [currentData, activeTab, searchQuery, selectedLetter, sortBy]);

    const isFiltered = searchQuery.trim() !== '' || selectedLetter !== 'ALL' || sortBy !== 'id-asc';

    const handleResetFilter = () => {
        setSearchQuery('');
        setSelectedLetter('ALL');
        setSortBy('id-asc');
    };

    return (
        <div className="space-y-4">
            {/* FIXED / STICKY HEADER FOR TITLE, TABS, SEARCH, AND FILTER */}
            <div className="sticky -top-6 admin-sticky-head space-y-3.5 shadow-sm">
                {/* Top Row: Title + Tabs Switcher */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            Master Data
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                {tabLabel}
                            </span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Manage Areas, Processes, and Defect definitions.
                        </p>
                    </div>

                    {/* Tabs Switcher with Item Badges */}
                    <div className="inline-flex p-1 bg-gray-200/80 rounded-lg self-start md:self-auto">
                        {(['AREAS', 'PROCESSES', 'DEFECTS'] as MasterTab[]).map(tab => {
                            const count = tab === 'AREAS' ? areas.length : tab === 'PROCESSES' ? processes.length : defects.length;
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        isActive
                                            ? 'bg-white text-gray-950 shadow-sm font-semibold'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                                >
                                    <span>{tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                                    <span
                                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                            isActive
                                                ? 'bg-gray-900 text-white font-mono'
                                                : 'bg-gray-300 text-gray-700 font-mono'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Second Row: Search, Filter, Sort & Add Toolbar */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                    {/* Left: Search & Sort Controls */}
                    <div className="flex flex-1 flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={`Cari ${tabLabel.toLowerCase()} (nama / ID)...`}
                                className="w-full pl-9 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 rounded"
                                    title="Hapus pencarian"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Sort Selector */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as SortOption)}
                                className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
                            >
                                <option value="id-asc">Urutkan: ID (1 → 99)</option>
                                <option value="id-desc">Urutkan: ID (99 → 1)</option>
                                <option value="name-asc">Urutkan: Nama (A → Z)</option>
                                <option value="name-desc">Urutkan: Nama (Z → A)</option>
                            </select>
                        </div>
                    </div>

                    {/* Right: Add New Item Form */}
                    <form onSubmit={handleCreate} className="flex gap-2 items-center flex-shrink-0">
                        <input
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            required
                            type="text"
                            placeholder={`Nama ${tabLabel.toLowerCase()} baru...`}
                            className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors w-48 sm:w-60"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !newItem.trim()}
                            className="bg-gray-900 text-white px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah</span>
                        </button>
                    </form>
                </div>

                {/* Third Row: Alphabet Quick Filter & Status Counter */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    {/* Alphabet Quick Filter Chips */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-full text-xs">
                        <span className="text-[11px] font-medium text-gray-400 mr-1 flex items-center gap-1 flex-shrink-0">
                            <Filter className="w-3 h-3" />
                            Filter Abjad:
                        </span>
                        <button
                            onClick={() => setSelectedLetter('ALL')}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex-shrink-0 ${
                                selectedLetter === 'ALL'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Semua
                        </button>
                        {availableLetters.map(letter => (
                            <button
                                key={letter}
                                onClick={() => setSelectedLetter(selectedLetter === letter ? 'ALL' : letter)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors flex-shrink-0 ${
                                    selectedLetter === letter
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>

                    {/* Result Counter & Reset Button */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 self-end ml-auto flex-shrink-0">
                        <span>
                            Menampilkan <strong className="text-gray-900 font-semibold">{filteredAndSorted.length}</strong> dari{' '}
                            {currentData.length} {tabLabel.toLowerCase()}
                        </span>
                        {isFiltered && (
                            <button
                                onClick={handleResetFilter}
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors ml-1 font-medium"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset Filter
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Message Notification */}
            {errorMsg && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center justify-between">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-700 p-0.5">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Master Data Table Card */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/90 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="text-left py-3 px-4 w-24">ID</th>
                                <th className="text-left py-3 px-4">Nama {tabLabel}</th>
                                <th className="text-right py-3 px-4 w-36">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredAndSorted.map(({ row }) => (
                                <tr key={row.id} className="hover:bg-gray-50/80 transition-colors group">
                                    <td className="py-2.5 px-4 text-gray-500 font-mono text-xs">{row.id}</td>
                                    <td className="py-2.5 px-4 font-medium text-gray-900">{row.name}</td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="inline-flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(row.id, row.name)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors"
                                                title={`Edit ${row.name}`}
                                            >
                                                <Edit2 className="w-3 h-3" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row.id, row.name)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition-colors"
                                                title={`Hapus ${row.name}`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredAndSorted.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-gray-400 text-sm">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300 stroke-1" />
                                            <p className="font-medium text-gray-600">Tidak ada data ditemukan</p>
                                            {isFiltered ? (
                                                <p className="text-xs text-gray-400 max-w-sm">
                                                    Tidak ada {tabLabel.toLowerCase()} yang sesuai dengan kriteria pencarian/filter saat ini.
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-400">
                                                    Belum ada {tabLabel.toLowerCase()} yang ditambahkan.
                                                </p>
                                            )}
                                            {isFiltered && (
                                                <button
                                                    onClick={handleResetFilter}
                                                    className="mt-2 text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Reset Pencarian & Filter
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
