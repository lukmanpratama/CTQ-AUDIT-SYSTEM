'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

const CTQ_TYPES = [
    'External Compliance',
    'Safety',
    'Function',
    'Durability',
    'Appearance',
    'Color',
    'Fit&Comfort',
];

interface SetupDefectTqc {
    setupDefectTqcId: number;
    defectName: string;
    ctqType: string;
}

export default function SetupDefectTqcPage() {
    const [data, setData] = useState<SetupDefectTqc[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const [id, setId] = useState<number | null>(null);
    const [defectName, setDefectName] = useState('');
    const [ctqType, setCtqType] = useState(CTQ_TYPES[0]);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tqc-setup-defect');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenNew = () => {
        setIsEditMode(false);
        setId(null);
        setDefectName('');
        setCtqType(CTQ_TYPES[0]);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: SetupDefectTqc) => {
        setIsEditMode(true);
        setId(item.setupDefectTqcId);
        setDefectName(item.defectName);
        setCtqType(item.ctqType);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleDelete = async (deleteId: number) => {
        if (!confirm('Are you sure you want to delete this mapping?')) return;
        try {
            const res = await fetch(`/api/tqc-setup-defect/${deleteId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            fetchData();
        } catch (error) {
            alert(error);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json<any>(worksheet);

            const payload: any[] = [];
            let duplicateCount = 0;
            let invalidCount = 0;
            const seenDefects = new Set<string>();

            for (const row of json) {
                const rawDefectNameStr = row['Defect Name']?.toString();
                const rawCtqTypeStr = row['CTQ Type']?.toString();

                if (!rawDefectNameStr || !rawCtqTypeStr) {
                    invalidCount++;
                    continue;
                }

                const defectName = rawDefectNameStr.replace(/\s+/g, ' ').trim();
                const ctqType = rawCtqTypeStr.replace(/\s+/g, ' ').trim();

                if (defectName && ctqType) {
                    const lowerDefect = defectName.toLowerCase();
                    if (seenDefects.has(lowerDefect)) {
                        duplicateCount++;
                    } else {
                        seenDefects.add(lowerDefect);
                        payload.push({ defectName, ctqType });
                    }
                } else {
                    invalidCount++;
                }
            }

            if (payload.length === 0) {
                alert('No valid rows found to import! Make sure columns are "Defect Name" and "CTQ Type" and valid CTQ types are used.');
                return;
            }

            const res = await fetch('/api/tqc-setup-defect/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.message || 'Failed to import bulk mappings');
            }

            let alertMessage = `Successfully imported ${payload.length} unique records.`;
            if (duplicateCount > 0 || invalidCount > 0) {
                alertMessage += `\n\nSkipped ${duplicateCount} exact duplicates.`;
                alertMessage += `\nSkipped ${invalidCount} invalid rows (missing columns or misspelled CTQ Types).`;
            }

            alert(alertMessage);
            fetchData();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleClearAll = async () => {
        if (!confirm('WARNING: Are you sure you want to delete ALL data mappings? This cannot be undone.')) return;
        try {
            const res = await fetch('/api/tqc-setup-defect/bulk', { method: 'DELETE' });
            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.message || 'Failed to clear all data');
            }
            alert('All mappings have been cleared.');
            fetchData();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!defectName.trim()) {
            setErrorMsg('Defect Name is required');
            return;
        }

        const payload = { defectName: defectName.trim(), ctqType };

        try {
            const url = isEditMode ? `/api/tqc-setup-defect/${id}` : '/api/tqc-setup-defect';
            const method = isEditMode ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.message || 'Failed to save');
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            setErrorMsg(error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Setup Defect TQC</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Map TQC Excel Defect Names to standardized CTQ Types.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleClearAll}
                        disabled={uploading || data.length === 0}
                        className="flex items-center px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Clear All
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {uploading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Importing...
                            </span>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                Import Excel
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleOpenNew}
                        className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Mapping
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                        <tr>
                            <th className="px-5 py-3 font-semibold">Defect Name (From TQC)</th>
                            <th className="px-5 py-3 font-semibold">CTQ Type Classification</th>
                            <th className="px-5 py-3 font-semibold w-24 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={3} className="px-5 py-12 text-center text-gray-400 font-medium">Loading mappings...</td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-5 py-12 text-center text-gray-500">No defect mappings defined yet.</td>
                            </tr>
                        ) : (
                            data.map((item) => (
                                <tr key={item.setupDefectTqcId} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-gray-900 font-medium">{item.defectName}</td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {item.ctqType}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleOpenEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Edit">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => handleDelete(item.setupDefectTqcId)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Mapping' : 'New Defect Mapping'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6">
                            {errorMsg && (
                                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-md">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Defect Name</label>
                                    <input
                                        type="text"
                                        value={defectName}
                                        onChange={(e) => setDefectName(e.target.value)}
                                        placeholder="e.g. Broken Stitching"
                                        className="w-full h-10 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
                                        autoFocus
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Enter the exact name as it appears in TQC Excel reports.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CTQ Type</label>
                                    <select
                                        value={ctqType}
                                        onChange={(e) => setCtqType(e.target.value)}
                                        className="w-full h-10 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm bg-white"
                                    >
                                        {CTQ_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors shadow-sm"
                                >
                                    {isEditMode ? 'Save Changes' : 'Create Mapping'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
