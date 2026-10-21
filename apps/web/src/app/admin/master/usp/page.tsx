'use client';

import { useEffect, useState } from 'react';
import { modelLabel } from '../../../../lib/model-label';

export default function MasterUspPage() {
    const [usps, setUsps] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);

    // Filters
    const [filterModel, setFilterModel] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchCode, setSearchCode] = useState<string>('');

    // Modal Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUspId, setEditingUspId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        setupModelId: '',
        uspCode: '',
        uspName: '',
        description: '',
        isActive: true
    });

    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        fetchModels();
    }, []);

    useEffect(() => {
        fetchUsps();
    }, [filterModel, filterStatus]);

    const fetchModels = async () => {
        try {
            const data = await fetch('/api/ctq-setup/models').then(res => res.json());
            setModels(Array.isArray(data) ? data : []);
        } catch {
            setModels([]);
        }
    };

    const fetchUsps = async () => {
        try {
            const query = new URLSearchParams();
            if (filterModel) query.append('modelId', filterModel);
            if (filterStatus) query.append('status', filterStatus);

            const data = await fetch(`/api/master/usps?${query.toString()}`).then(res => res.json());
            setUsps(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Error fetching USPs', e);
        }
    };

    const openModal = (usp: any = null) => {
        setErrorMsg('');
        if (usp) {
            setEditingUspId(usp.uspId);
            setFormData({
                setupModelId: usp.setupModelId?.toString() || '',
                uspCode: usp.uspCode || '',
                uspName: usp.uspName || '',
                description: usp.description || '',
                isActive: usp.isActive
            });
        } else {
            setEditingUspId(null);
            setFormData({
                setupModelId: filterModel || '',
                uspCode: '',
                uspName: '',
                description: '',
                isActive: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!formData.setupModelId) {
            setErrorMsg('Model is required.');
            return;
        }

        try {
            const method = editingUspId ? 'PUT' : 'POST';
            const url = editingUspId ? `/api/master/usps/${editingUspId}` : `/api/master/usps`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    setupModelId: BigInt(formData.setupModelId).toString(),
                    uspCode: formData.uspCode.trim() || `USP-${Date.now()}`,
                    uspName: formData.uspName.trim(),
                    description: '', // Discard description safely
                    isActive: formData.isActive
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to save USP');
            }

            setIsModalOpen(false);
            fetchUsps();
        } catch (err: any) {
            setErrorMsg(err.message);
        }
    };

    const handleDelete = async (uspId: string) => {
        if (!window.confirm('Are you sure you want to delete this USP? If it’s in use, consider changing status to INACTIVE instead.')) return;

        try {
            const res = await fetch(`/api/master/usps/${uspId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Unable to delete');
            }
            fetchUsps();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const toggleStatus = async (usp: any) => {
        try {
            const res = await fetch(`/api/master/usps/${usp.uspId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !usp.isActive })
            });
            if (res.ok) fetchUsps();
        } catch (e) {
            console.error('Failed toggling status', e);
        }
    };

    const filteredUsps = usps.filter((u: any) => {
        if (!searchCode) return true;
        const s = searchCode.toLowerCase();
        return (u.uspCode?.toLowerCase().includes(s) || u.uspName?.toLowerCase().includes(s));
    });

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900">Master USP Data</h1>
                    <p className="text-xs text-gray-500 mt-1">Manage Unique Selling Points mapped explicitly to specific Models.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
                >
                    + Create Data USP
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-4">
                <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Filter Model</label>
                    <select
                        className="w-full text-sm border-gray-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500"
                        value={filterModel}
                        onChange={e => setFilterModel(e.target.value)}
                    >
                        <option value="">-- All Models --</option>
                        {models.map(m => (
                            <option key={m.setupModelId} value={m.setupModelId}>
                                {modelLabel(m)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="w-48">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Filter Status</label>
                    <select
                        className="w-full text-sm border-gray-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="">-- All Status --</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                    </select>
                </div>
                <div className="w-64">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Search USP Name/Code</label>
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full text-sm border-gray-300 rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500"
                        value={searchCode}
                        onChange={e => setSearchCode(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg flex-1 overflow-hidden flex flex-col">
                {/* Rows scroll inside the card so the title, filters and column headers stay in view */}
                <div className="sticky-thead overflow-auto flex-1 max-h-[calc(100vh-17rem)]">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                <th className="px-4 py-3">Setup Model</th>
                                <th className="px-4 py-3">USP Name</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-200 text-gray-800">
                            {filteredUsps.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No USPs found for current filters.</td></tr>
                            ) : (
                                filteredUsps.map(usp => (
                                    <tr key={usp.uspId} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-gray-900 border-l-2 border-transparent">
                                            {modelLabel(usp.setupModel) || 'UNKNOWN'}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium text-blue-700">
                                            {usp.uspName}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <button
                                                onClick={() => toggleStatus(usp)}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${usp.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                            >
                                                {usp.isActive ? 'ACTIVE' : 'INACTIVE'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-gray-400">
                                            {new Date(usp.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-2.5 text-right space-x-3">
                                            <button onClick={() => openModal(usp)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">Edit</button>
                                            <button onClick={() => handleDelete(usp.uspId)} className="text-red-500 hover:text-red-700 font-medium text-xs">Delete</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-[500px] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">{editingUspId ? 'Edit USP Formulation' : 'Create New USP'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
                            {errorMsg && (
                                <div className="bg-red-50 text-red-600 border border-red-200 text-xs px-3 py-2 rounded font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Model <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full text-sm border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-900"
                                    value={formData.setupModelId}
                                    onChange={e => setFormData({ ...formData, setupModelId: e.target.value })}
                                >
                                    <option value="" disabled>-- Select Model --</option>
                                    {models.map(m => (
                                        <option key={m.setupModelId} value={m.setupModelId}>{modelLabel(m)}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">USP Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    className="w-full text-sm border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 font-medium text-blue-900"
                                    value={formData.uspName}
                                    onChange={e => setFormData({ ...formData, uspName: e.target.value })}
                                    placeholder="e.g. 2.5 D NOSEW"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full text-sm border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 font-bold"
                                    value={formData.isActive ? 'true' : 'false'}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                                >
                                    <option value="true" className="text-green-600 font-bold">ACTIVE</option>
                                    <option value="false" className="text-gray-500 font-bold">INACTIVE</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 mt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-100 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded shadow-md transition-all"
                                >
                                    {editingUspId ? 'Save Changes' : 'Create USP'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
