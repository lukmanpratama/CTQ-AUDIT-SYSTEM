'use client';

import { useEffect, useState } from 'react';

type MasterTab = 'AREAS' | 'PROCESSES' | 'DEFECTS';

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState<MasterTab>('AREAS');
    const [areas, setAreas] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);
    const [defects, setDefects] = useState<any[]>([]);
    const [newItem, setNewItem] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        fetchData();
        setErrorMsg('');
    }, [activeTab]);

    const fetchData = async () => {
        try {
            if (activeTab === 'AREAS') setAreas(await (await fetch('/api/master/areas')).text().then(t => t ? JSON.parse(t) : []));
            else if (activeTab === 'PROCESSES') setProcesses(await (await fetch('/api/master/processes')).text().then(t => t ? JSON.parse(t) : []));
            else if (activeTab === 'DEFECTS') setDefects(await (await fetch('/api/master/defects')).text().then(t => t ? JSON.parse(t) : []));
        } catch (e) {
            console.error('Error fetching', e);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        const endpoint = activeTab.toLowerCase();
        const fieldName = activeTab === 'AREAS' ? 'area' : activeTab === 'PROCESSES' ? 'process' : 'defect';
        await fetch(`/api/master/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [fieldName]: newItem.toUpperCase() })
        });
        setNewItem('');
        fetchData();
    };

    const handleEdit = async (id: string, oldValue: string) => {
        const newValue = window.prompt(`Edit value:`, oldValue);
        if (!newValue || newValue === oldValue) return;
        setErrorMsg('');
        const endpoint = activeTab.toLowerCase();
        const fieldName = activeTab === 'AREAS' ? 'area' : activeTab === 'PROCESSES' ? 'process' : 'defect';
        const res = await fetch(`/api/master/${endpoint}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [fieldName]: newValue.toUpperCase() })
        });
        if (!res.ok) setErrorMsg('Failed to update.');
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this item? It may be referenced by existing configurations.')) return;
        setErrorMsg('');
        const res = await fetch(`/api/master/${activeTab.toLowerCase()}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.text().then(t => t ? JSON.parse(t) : {});
            setErrorMsg(data.message || 'Cannot delete — item is in use.');
        } else {
            fetchData();
        }
    };

    const tabLabel = activeTab.slice(0, -1); // Area, Process, Defect
    const currentData = activeTab === 'AREAS' ? areas : activeTab === 'PROCESSES' ? processes : defects;
    const getRow = (item: any) => {
        if (activeTab === 'AREAS') return { id: item.areaId, name: item.area };
        if (activeTab === 'PROCESSES') return { id: item.processId, name: item.process };
        return { id: item.defectId, name: item.defect };
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-gray-900">Master Data</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage Areas, Processes, and Defect definitions.</p>
            </div>

            {errorMsg && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                    {errorMsg}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    {(['AREAS', 'PROCESSES', 'DEFECTS'] as MasterTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setNewItem(''); }}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${activeTab === tab
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-400 hover:text-gray-700'
                                }`}
                        >
                            {tab.charAt(0) + tab.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    {/* Add form */}
                    <form onSubmit={handleCreate} className="flex gap-2 mb-4">
                        <input
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            required type="text"
                            placeholder={`New ${tabLabel.toLowerCase()} name`}
                            className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors"
                        />
                        <button type="submit" className="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                            Add
                        </button>
                    </form>

                    {/* Table */}
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 w-20">ID</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400">Name</th>
                                <th className="text-right py-2 text-xs font-medium text-gray-400 w-28"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map(item => {
                                const row = getRow(item);
                                return (
                                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{row.id}</td>
                                        <td className="py-2.5 pr-4 text-gray-800">{row.name}</td>
                                        <td className="py-2.5 text-right">
                                            <div className="inline-flex gap-1">
                                                <button
                                                    onClick={() => handleEdit(row.id, row.name)}
                                                    className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row.id)}
                                                    className="px-2 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {currentData.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-gray-400 text-sm">
                                        No {activeTab.toLowerCase()} defined yet.
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
