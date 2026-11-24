'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, X, Plus, Edit2, Trash2, RotateCcw, Filter } from 'lucide-react';
import UsersPanel from '../../../components/admin/UsersPanel';
import ColumnFilter from '../../../components/admin/ColumnFilter';
import SearchInput from '../../../components/admin/SearchInput';
import TablePager, { usePagination } from '../../../components/admin/TablePager';
import { useColumnFilters } from '../../../lib/column-filters';

type MasterTab = 'AREAS' | 'PROCESSES' | 'DEFECTS' | 'USERS';
const TABS: MasterTab[] = ['AREAS', 'PROCESSES', 'DEFECTS', 'USERS'];

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState<MasterTab>('AREAS');
    const [areas, setAreas] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);
    const [defects, setDefects] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [newItem, setNewItem] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Search & Filter state (sorting comes from the column headers)
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLetter, setSelectedLetter] = useState<string>('ALL');

    // Fetch all collections on mount to show counts on tabs immediately.
    // ?tab=users opens a tab directly (the old /admin/users page redirects there).
    useEffect(() => {
        const tab = new URLSearchParams(window.location.search).get('tab')?.toUpperCase();
        if (tab && TABS.includes(tab as MasterTab)) setActiveTab(tab as MasterTab);
        fetchAllMasterData();
    }, []);

    const selectTab = (tab: MasterTab) => {
        setActiveTab(tab);
        // Keep the tab in the URL so a reload or a shared link opens the same tab
        window.history.replaceState(null, '', tab === 'AREAS' ? window.location.pathname : `?tab=${tab.toLowerCase()}`);
    };

    // Reset local filters when switching tab
    useEffect(() => {
        setSearchQuery('');
        setSelectedLetter('ALL');
        setNewItem('');
        setErrorMsg('');
    }, [activeTab]);

    const fetchAllMasterData = async () => {
        try {
            const [areasData, processesData, defectsData, usersData] = await Promise.all([
                fetch('/api/master/areas').then(r => r.json()).catch(() => []),
                fetch('/api/master/processes').then(r => r.json()).catch(() => []),
                fetch('/api/master/defects').then(r => r.json()).catch(() => []),
                fetch('/api/master/users').then(r => r.json()).catch(() => []),
            ]);
            setAreas(Array.isArray(areasData) ? areasData : []);
            setProcesses(Array.isArray(processesData) ? processesData : []);
            setDefects(Array.isArray(defectsData) ? defectsData : []);
            setUsers(Array.isArray(usersData) ? usersData : []);
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
            else if (activeTab === 'USERS') setUsers(arr);
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

    const tabLabel = activeTab === 'AREAS' ? 'Area' : activeTab === 'PROCESSES' ? 'Process' : activeTab === 'DEFECTS' ? 'Defect' : 'User';
    const tabCounts: Record<MasterTab, number> = { AREAS: areas.length, PROCESSES: processes.length, DEFECTS: defects.length, USERS: users.length };
    // The Users tab has its own panel; the generic list below only serves Areas / Processes / Defects
    const isUsersTab = activeTab === 'USERS';
    const currentData = activeTab === 'AREAS' ? areas : activeTab === 'PROCESSES' ? processes : activeTab === 'DEFECTS' ? defects : [];

    const getRow = (item: any) => {
        if (activeTab === 'AREAS') return { id: item.areaId, name: item.area || '' };
        if (activeTab === 'PROCESSES') return { id: item.processId, name: item.process || '' };
        return { id: item.defectId, name: item.defect || '' };
    };

    // Header filters and sort (ID, name); each tab starts without filters, sorted by ID
    const cf = useColumnFilters(currentData, {
        id: { get: item => getRow(item).id, kind: 'number' },
        name: { get: item => getRow(item).name },
    }, undefined, { initialSort: { key: 'id', dir: 'asc' } });
    useEffect(() => { cf.clearAll(); }, [activeTab]);

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

    // Search and letter filters on top of the header filters (cf.filtered is already sorted)
    const filteredAndSorted = useMemo(() => {
        let list = cf.filtered.map(item => ({
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

        return list;
    }, [cf.filtered, activeTab, searchQuery, selectedLetter]);

    const isFiltered = searchQuery.trim() !== '' || selectedLetter !== 'ALL' || cf.activeCount > 0;

    const pager = usePagination(filteredAndSorted, {
        initialSize: 10,
        resetKey: [activeTab, searchQuery, selectedLetter, cf.filters, cf.sort],
    });

    const handleResetFilter = () => {
        setSearchQuery('');
        setSelectedLetter('ALL');
        cf.clearAll();
    };


    return (
        <div className="admin-page">
            {/* Title and tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="admin-page-title flex items-center gap-2">
                        Master Data
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                            {tabLabel}
                        </span>
                    </h1>
                    <p className="admin-page-subtitle">
                        Manage Areas, Processes, Defect definitions, and Users.
                    </p>
                </div>

                {/* Tabs Switcher with Item Badges */}
                <div className="inline-flex flex-wrap p-1 bg-gray-200/80 rounded-lg self-start md:self-auto">
                    {TABS.map(tab => {
                        const count = tabCounts[tab];
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => selectTab(tab)}
                                className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
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

            {isUsersTab && <UsersPanel users={users} onChanged={fetchActiveData} />}

            {!isUsersTab && (<>
                {/* Toolbar: search and the add form, then the alphabet quick filter */}
                <div className="admin-toolbar">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder={`Cari ${tabLabel.toLowerCase()} (nama / ID)...`}
                        className="flex-1 min-w-[220px]"
                    />

                    <form onSubmit={handleCreate} className="flex gap-2 items-center flex-shrink-0">
                        <input
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            required
                            type="text"
                            placeholder={`Nama ${tabLabel.toLowerCase()} baru...`}
                            aria-label={`Nama ${tabLabel.toLowerCase()} baru`}
                            className="admin-input w-48 sm:w-60"
                        />
                        <button type="submit" disabled={isSubmitting || !newItem.trim()} className="admin-btn admin-btn-primary">
                            <Plus className="w-4 h-4" />
                            <span>Tambah</span>
                        </button>
                    </form>

                    <div className="basis-full flex flex-wrap items-center justify-between gap-2">
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

                        {isFiltered && (
                            <button
                                onClick={handleResetFilter}
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset Filter
                            </button>
                        )}
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

                {/* Master Data Table Card: the rows scroll, the column headers stay */}
                <div className="admin-table-card">
                    <div className="admin-table-scroll">
                        <table className="w-full text-sm">
                            <thead className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left py-3 px-4 w-24"><ColumnFilter {...cf.bind('id', 'ID')} /></th>
                                    <th className="text-left py-3 px-4"><ColumnFilter {...cf.bind('name', `Nama ${tabLabel}`)} /></th>
                                    <th className="text-right py-3 px-4 w-36">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pager.pageRows.map(({ row }) => (
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
                    <TablePager
                        page={pager.page}
                        pageSize={pager.pageSize}
                        total={pager.total}
                        onPage={pager.setPage}
                        onPageSize={pager.setPageSize}
                        noun={tabLabel.toLowerCase()}
                        extra={currentData.length !== pager.total ? <span className="text-gray-400">(difilter dari {currentData.length})</span> : undefined}
                    />
                </div>
            </>)}
        </div>
    );
}
