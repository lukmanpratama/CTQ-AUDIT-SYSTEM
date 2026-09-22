'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SetupCtqPage() {
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [newModel, setNewModel] = useState('');
    const [editingModelId, setEditingModelId] = useState<string | null>(null);
    const [editingModelName, setEditingModelName] = useState('');

    const handleViewFile = (base64Str: string) => {
        try {
            const arr = base64Str.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || '';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error('Failed to view file', e);
            alert('Gagal membuka file.');
        }
    };

    useEffect(() => { fetchModels(); }, []);

    const fetchModels = async () => {
        const res = await fetch('/api/ctq-setup/models');
        setModels(await res.json());
    };

    const handleCreateModel = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch('/api/ctq-setup/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelName: newModel.toUpperCase() })
        });
        setNewModel('');
        fetchModels();
    };

    const handleUploadPicture = (modelId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const base64 = reader.result;
                const res = await fetch(`/api/ctq-setup/models/${modelId}/picture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pictureBase64: base64 })
                });

                if (!res.ok) {
                    const text = await res.text();
                    alert('Upload failed: ' + text);
                }
                fetchModels();
            } catch (err: any) {
                alert('Upload error: ' + err.message);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveModelName = async (modelId: string) => {
        if (!editingModelName.trim()) return;
        await fetch(`/api/ctq-setup/models/${modelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelName: editingModelName })
        });
        setEditingModelId(null);
        fetchModels();
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-gray-900">CTQ Setup</h1>
                <p className="text-sm text-gray-500 mt-0.5">Define model hierarchies: Model &rarr; Area &rarr; Process &rarr; Defect.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-800">Models</h2>
                </div>
                <div className="p-4">
                    <form onSubmit={handleCreateModel} className="flex gap-2 mb-4">
                        <input
                            value={newModel}
                            onChange={e => setNewModel(e.target.value)}
                            required type="text"
                            placeholder="New model name"
                            className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors"
                        />
                        <button type="submit" className="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                            Add Model
                        </button>
                    </form>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 w-20">ID</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400">Model Name</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 w-32">Photo</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 w-32">Int. Audit</th>
                                <th className="text-right py-2 text-xs font-medium text-gray-400 w-32"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {models.map(m => (
                                <tr key={m.setupModelId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                                    <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{m.setupModelId}</td>
                                    <td className="py-2.5 pr-4 text-gray-800">
                                        {editingModelId === m.setupModelId ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingModelName}
                                                    onChange={e => setEditingModelName(e.target.value)}
                                                    className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                                                />
                                                <button onClick={() => handleSaveModelName(m.setupModelId)} className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700">Save</button>
                                                <button onClick={() => setEditingModelId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span>{m.modelName}</span>
                                                <button
                                                    onClick={() => { setEditingModelId(m.setupModelId); setEditingModelName(m.modelName); }}
                                                    className="text-xs text-gray-400 hover:text-blue-600 underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2.5 pr-4 text-gray-800">
                                        {m.picture ? (
                                            <div className="flex items-center gap-2">
                                                <img src={m.picture} alt="model" className="w-10 h-10 object-contain rounded border" />
                                                <label className="text-xs text-blue-600 cursor-pointer hover:underline">
                                                    Change
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadPicture(m.setupModelId, e)} />
                                                </label>
                                            </div>
                                        ) : (
                                            <label className="text-xs text-blue-600 cursor-pointer hover:underline">
                                                + Upload Photo
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadPicture(m.setupModelId, e)} />
                                            </label>
                                        )}
                                    </td>
                                    <td className="py-2.5 pr-4 text-gray-800">
                                        {m.internalAuditFile ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleViewFile(m.internalAuditFile)} className="text-xs text-blue-800 hover:underline font-semibold bg-gray-100 border border-gray-200 px-2.5 py-1 rounded">
                                                    👁 View
                                                </button>
                                                <a href={m.internalAuditFile} download={`Audit_${m.modelName}`} className="text-xs text-blue-800 hover:underline font-semibold bg-blue-50 border border-blue-100 px-2.5 py-1 rounded">
                                                    ↓ Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 text-right">
                                        <button
                                            onClick={() => router.push(`/admin/setup/tree/${m.setupModelId}`)}
                                            className="px-2.5 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            Configure &rarr;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {models.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No models configured yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
