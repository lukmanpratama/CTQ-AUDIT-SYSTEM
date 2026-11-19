'use client';

import { useEffect, useRef, useState } from 'react';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { modelLabel } from '../../lib/model-label';

// USP (selling point) management per model, shown as the "USP" tab of Setup CTQ
// (it used to be its own "Master USP (Model)" page). Setup CTQ passes its model list.
export default function UspPanel({ models }: { models: any[] }) {
    const [usps, setUsps] = useState<any[]>([]);

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
    const [saving, setSaving] = useState(false);

    // "Tambah USP" takes several names at once for one model, one input per name
    const [newNames, setNewNames] = useState<string[]>(['']);
    const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusRow, setFocusRow] = useState<number | null>(null);
    // USPs the chosen model already has, to flag names that would be refused as duplicates
    const [existingNames, setExistingNames] = useState<string[]>([]);

    useEffect(() => {
        fetchUsps();
    }, [filterModel, filterStatus]);

    useEffect(() => {
        if (focusRow === null) return;
        nameRefs.current[focusRow]?.focus();
        setFocusRow(null);
    }, [focusRow, newNames]);

    useEffect(() => {
        if (!isModalOpen || editingUspId || !formData.setupModelId) { setExistingNames([]); return; }
        let cancelled = false;
        fetch(`/api/master/usps?modelId=${formData.setupModelId}`)
            .then(r => r.json())
            .then(data => { if (!cancelled) setExistingNames(Array.isArray(data) ? data.map((u: any) => String(u.uspName)) : []); })
            .catch(() => { if (!cancelled) setExistingNames([]); });
        return () => { cancelled = true; };
    }, [isModalOpen, editingUspId, formData.setupModelId]);

    const existingKeys = new Set(existingNames.map(n => n.trim().toUpperCase()));
    // Names that will be sent: filled in, repeats counted once
    const uniqueNewCount = new Set(newNames.map(n => n.trim().toUpperCase()).filter(Boolean)).size;

    const setNameAt = (i: number, value: string) => setNewNames(rows => rows.map((r, j) => (j === i ? value : r)));
    const addRowAfter = (i: number) => {
        setNewNames(rows => [...rows.slice(0, i + 1), '', ...rows.slice(i + 1)]);
        setFocusRow(i + 1);
    };
    const removeRow = (i: number) => {
        setNewNames(rows => (rows.length === 1 ? [''] : rows.filter((_, j) => j !== i)));
        setFocusRow(Math.max(0, i - 1));
    };
    // Pasting a column copied from Excel (one name per line) fills one row per line
    const pasteRows = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const lines = e.clipboardData.getData('text').split(/\r?\n|\t/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return;
        e.preventDefault();
        setNewNames(rows => [...rows.slice(0, i), ...lines, ...rows.slice(i + 1)].filter((r, j, all) => r.trim() || all.length === 1));
        setFocusRow(i + lines.length - 1);
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
            setNewNames(['']);
            setFocusRow(0);
        }
        setIsModalOpen(true);
    };

    // Creates one USP per filled-in name; names that fail stay in the form with the reason
    const createMany = async () => {
        const seen = new Set<string>();
        const names = newNames.map(n => n.trim()).filter(n => {
            const key = n.toUpperCase();
            if (!n || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        if (names.length === 0) {
            setErrorMsg('Isi minimal satu nama USP.');
            return;
        }
        setSaving(true);
        const stamp = Date.now();
        const failed: { name: string; reason: string }[] = [];
        for (const [i, name] of names.entries()) {
            try {
                const res = await fetch('/api/master/usps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        setupModelId: BigInt(formData.setupModelId).toString(),
                        // Codes are unique per model, so a batch can't share one timestamp
                        uspCode: `USP-${stamp}-${i + 1}`,
                        uspName: name,
                        description: '',
                        isActive: formData.isActive,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    failed.push({ name, reason: err.message || `HTTP ${res.status}` });
                }
            } catch (e: any) {
                failed.push({ name, reason: e.message || 'Network error' });
            }
        }
        setSaving(false);
        fetchUsps();
        if (failed.length === 0) {
            setIsModalOpen(false);
            return;
        }
        setNewNames(failed.map(f => f.name));
        const saved = names.length - failed.length;
        setErrorMsg(`${saved > 0 ? `${saved} USP tersimpan. ` : ''}Gagal disimpan: ${failed.map(f => `${f.name} (${f.reason})`).join('; ')}`);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!formData.setupModelId) {
            setErrorMsg('Model is required.');
            return;
        }
        if (!editingUspId) {
            await createMany();
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
                const err = await res.json().catch(() => ({}));
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
                const err = await res.json().catch(() => ({}));
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

    const fieldCls = 'w-full text-xs border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900';

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1 min-w-0">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Filter Model</label>
                    <select className={fieldCls} value={filterModel} onChange={e => setFilterModel(e.target.value)}>
                        <option value="">-- All Models --</option>
                        {models.map(m => (
                            <option key={m.setupModelId} value={m.setupModelId}>
                                {modelLabel(m)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:w-44">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Filter Status</label>
                    <select className={fieldCls} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">-- All Status --</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                    </select>
                </div>
                <div className="md:w-56">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Search USP Name/Code</label>
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className={`${fieldCls} pl-8`}
                            value={searchCode}
                            onChange={e => setSearchCode(e.target.value)}
                        />
                    </div>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah USP
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                        <thead>
                            <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                <th className="px-4 py-3">Setup Model</th>
                                <th className="px-4 py-3">USP Name</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-200 text-gray-800">
                            {filteredUsps.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No USPs found for current filters.</td></tr>
                            ) : (
                                filteredUsps.map(usp => (
                                    <tr key={usp.uspId} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-4 py-2.5 font-medium text-gray-900">
                                            {modelLabel(usp.setupModel) || 'UNKNOWN'}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium text-blue-700">
                                            {usp.uspName}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <button
                                                onClick={() => toggleStatus(usp)}
                                                title="Klik untuk mengubah status"
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${usp.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                            >
                                                {usp.isActive ? 'ACTIVE' : 'INACTIVE'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-gray-400">
                                            {new Date(usp.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {/* Same action buttons as the Master Data lists */}
                                            <div className="inline-flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(usp)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors">
                                                    <Edit2 className="w-3 h-3" />
                                                    Edit
                                                </button>
                                                <button onClick={() => handleDelete(usp.uspId)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition-colors">
                                                    <Trash2 className="w-3 h-3" />
                                                    Hapus
                                                </button>
                                            </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-[500px] max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">{editingUspId ? 'Edit USP Formulation' : 'Tambah USP'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 overflow-y-auto">
                            {errorMsg && (
                                <div className="bg-red-50 text-red-600 border border-red-200 text-xs px-3 py-2 rounded font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Model <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-900"
                                    value={formData.setupModelId}
                                    onChange={e => setFormData({ ...formData, setupModelId: e.target.value })}
                                >
                                    <option value="" disabled>-- Select Model --</option>
                                    {models.map(m => (
                                        <option key={m.setupModelId} value={m.setupModelId}>{modelLabel(m)}</option>
                                    ))}
                                </select>
                            </div>

                            {editingUspId ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">USP Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 font-medium text-blue-900"
                                        value={formData.uspName}
                                        onChange={e => setFormData({ ...formData, uspName: e.target.value })}
                                        placeholder="e.g. 2.5 D NOSEW"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-baseline justify-between mb-1">
                                        <label className="block text-xs font-bold text-gray-700">
                                            USP Name <span className="text-red-500">*</span>
                                        </label>
                                        <span className="text-[11px] text-gray-400">
                                            {uniqueNewCount} nama
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {newNames.map((name, i) => {
                                            const isExisting = !!name.trim() && existingKeys.has(name.trim().toUpperCase());
                                            const isRepeat = !!name.trim() && newNames.findIndex(n => n.trim().toUpperCase() === name.trim().toUpperCase()) !== i;
                                            return (
                                                <div key={i}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 text-right text-[11px] text-gray-400 font-mono flex-shrink-0">{i + 1}</span>
                                                        <input
                                                            ref={el => { nameRefs.current[i] = el; }}
                                                            type="text"
                                                            value={name}
                                                            onChange={e => setNameAt(i, e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRowAfter(i); } }}
                                                            onPaste={e => pasteRows(i, e)}
                                                            placeholder={i === 0 ? 'e.g. 2.5 D NOSEW' : 'Nama USP berikutnya'}
                                                            className={`flex-1 min-w-0 text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 font-medium text-blue-900 ${isExisting || isRepeat ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300'}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(i)}
                                                            disabled={newNames.length === 1 && !name}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:pointer-events-none"
                                                            aria-label={`Hapus baris ${i + 1}`}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    {(isExisting || isRepeat) && (
                                                        <p className="ml-7 mt-0.5 text-[11px] text-amber-700">
                                                            {isExisting ? 'Sudah ada untuk model ini.' : 'Nama ganda di daftar ini; hanya disimpan sekali.'}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => addRowAfter(newNames.length - 1)}
                                        className="mt-2 ml-7 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Tambah baris
                                    </button>
                                    <p className="mt-1.5 ml-7 text-[11px] text-gray-400">
                                        Enter menambah baris baru. Bisa juga tempel daftar dari Excel (satu nama per baris).
                                    </p>
                                    {existingNames.length > 0 && (
                                        <p className="mt-1.5 ml-7 text-[11px] text-gray-500">
                                            Sudah ada untuk model ini: {existingNames.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 font-bold"
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
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded shadow-md transition-all disabled:opacity-50"
                                >
                                    {saving
                                        ? 'Menyimpan...'
                                        : editingUspId
                                            ? 'Save Changes'
                                            : `Simpan ${Math.max(1, uniqueNewCount)} USP`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
