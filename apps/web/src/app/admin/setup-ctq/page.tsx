'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Edit2, Settings2, Trash2, X } from 'lucide-react';
import { compressImage } from '../../../lib/compress-image';
import { modelLabel } from '../../../lib/model-label';
import { fetchPoArticlesForModelName } from '../../../lib/po-models';
import PoModelPicker from '../../../components/admin/PoModelPicker';
import UspPanel from '../../../components/admin/UspPanel';

type SetupTab = 'MODELS' | 'USP';
// Long article lists show this many chips until expanded
const ARTICLES_FOLDED = 8;

export default function SetupCtqPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<SetupTab>('MODELS');
    const [models, setModels] = useState<any[]>([]);
    const [loadError, setLoadError] = useState('');
    const [editingModelId, setEditingModelId] = useState<string | null>(null);
    const [editingModelName, setEditingModelName] = useState('');
    const [editingModelNo, setEditingModelNo] = useState('');
    const [editingArticles, setEditingArticles] = useState('');
    const [editError, setEditError] = useState('');
    const [editNote, setEditNote] = useState('');
    const [poArticlesLoading, setPoArticlesLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    // Models whose full article list is shown (long lists start folded)
    const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
    const toggleArticles = (id: string) => setExpandedArticles(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const handleViewFile = (base64Str: string) => {
        // The model list now sends a file URL (served by the API) instead of the base64 data
        if (!base64Str.startsWith('data:')) {
            window.open(base64Str, '_blank');
            return;
        }
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

    // ?tab=usp opens the USP tab directly (the old Master USP page redirects there)
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('tab')?.toLowerCase() === 'usp') setActiveTab('USP');
        fetchModels();
    }, []);

    const selectTab = (tab: SetupTab) => {
        setActiveTab(tab);
        window.history.replaceState(null, '', tab === 'USP' ? '?tab=usp' : window.location.pathname);
    };

    const fetchModels = async () => {
        try {
            const res = await fetch('/api/ctq-setup/models');
            const data = await res.json().catch(() => null);
            if (!res.ok || !Array.isArray(data)) {
                setModels([]);
                setLoadError(data?.message || `Failed to load models (${res.status}).`);
                return;
            }
            setModels(data);
            setLoadError('');
        } catch (e: any) {
            setModels([]);
            setLoadError(`Failed to load models: ${e.message}`);
        }
    };

    // "LA0398, LA0399" or one per line -> ['LA0398', 'LA0399']
    const parseArticles = (text: string) =>
        [...new Set(text.split(/[\s,;]+/).map(a => a.trim().toUpperCase()).filter(Boolean))];

    const readError = async (res: Response) => {
        const data = await res.json().catch(() => null);
        const msg = data?.message;
        return Array.isArray(msg) ? msg.join(', ') : (msg || `Request failed (${res.status}).`);
    };

    const handleUploadPicture = async (modelId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const original = e.target.files?.[0];
        if (!original) return;
        // Stored in the database and shown as a small card image: 1000 px is plenty
        const file = await compressImage(original, { maxDimension: 1000, quality: 0.8, preserveTransparency: true });

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

    const startEdit = (m: any) => {
        setEditingModelId(m.setupModelId);
        setEditingModelName(m.modelName);
        setEditingModelNo(m.modelNo || '');
        setEditingArticles((m.articles || []).map((a: any) => a.article).join(', '));
        setEditError('');
        setEditNote('');
    };

    // Adds the articles found in the POs of this model name that no other model owns yet
    const addArticlesFromPo = async (modelId: string) => {
        setEditError('');
        setEditNote('');
        setPoArticlesLoading(true);
        try {
            const { articles, found } = await fetchPoArticlesForModelName(editingModelName);
            if (!found) {
                setEditNote(`Model "${editingModelName.trim().toUpperCase()}" tidak ditemukan di Purchase Orders.`);
                return;
            }
            const ownedElsewhere = new Set(models
                .filter(m => m.setupModelId !== modelId)
                .flatMap(m => (m.articles || []).map((a: any) => String(a.article).toUpperCase())));
            const current = parseArticles(editingArticles);
            const added = articles.map(a => a.article).filter(a => !current.includes(a) && !ownedElsewhere.has(a));
            if (added.length === 0) {
                setEditNote('Tidak ada artikel baru di PO untuk model ini.');
                return;
            }
            setEditingArticles([...current, ...added].join(', '));
            setEditNote(`${added.length} artikel ditambahkan dari PO: ${added.join(', ')}. Klik Save untuk menyimpan.`);
        } catch (e: any) {
            setEditError(e.message);
        } finally {
            setPoArticlesLoading(false);
        }
    };

    const handleSaveModel = async (modelId: string) => {
        if (!editingModelName.trim()) return setEditError('Model Name is required.');
        const res = await fetch(`/api/ctq-setup/models/${modelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelName: editingModelName.trim().toUpperCase(),
                modelNo: editingModelNo.trim().toUpperCase(),
                articles: parseArticles(editingArticles)
            })
        });
        if (!res.ok) {
            setEditError(await readError(res));
            return;
        }
        setEditingModelId(null);
        fetchModels();
    };

    const handleDeleteModel = async (m: any) => {
        const label = modelLabel(m);
        if (!window.confirm(`Hapus model "${label}" (ID: ${m.setupModelId})?\nSetup area / process / defect, USP, dan artikel model ini ikut terhapus.\nModel yang sudah punya data inspeksi tidak bisa dihapus.`)) return;
        setActionError('');
        try {
            const res = await fetch(`/api/ctq-setup/models/${m.setupModelId}`, { method: 'DELETE' });
            if (!res.ok) {
                setActionError(await readError(res));
                return;
            }
            if (editingModelId === m.setupModelId) setEditingModelId(null);
            fetchModels();
        } catch (e: any) {
            setActionError(e.message || 'Gagal menghapus model.');
        }
    };

    // Names used by more than one Model No get a hint so admins fill in the articles
    const nameCounts = models.reduce((acc: Record<string, number>, m) => {
        acc[m.modelName] = (acc[m.modelName] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-5">
            {/* Title, tabs and the Add Model form stay at the top while the list scrolls */}
            <div className="admin-sticky-head space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">CTQ Setup</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {activeTab === 'MODELS'
                                ? <>Define model hierarchies: Model &rarr; Area &rarr; Process &rarr; Defect.</>
                                : 'Manage Unique Selling Points (USP) mapped to specific Models.'}
                        </p>
                    </div>
                    <div className="inline-flex p-1 bg-gray-200/80 rounded-lg self-start md:self-auto">
                        {([['MODELS', 'Models'], ['USP', 'USP']] as [SetupTab, string][]).map(([tab, label]) => {
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => selectTab(tab)}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${isActive
                                        ? 'bg-white text-gray-950 shadow-sm font-semibold'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`}
                                >
                                    <span>{label}</span>
                                    {tab === 'MODELS' && (
                                        <span className={`px-1.5 rounded-full text-[10px] font-mono ${isActive ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                            {models.length}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {activeTab === 'MODELS' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <PoModelPicker models={models} onCreated={fetchModels} />
                        {loadError && (
                            <div className="px-3 py-2 rounded border border-red-200 bg-red-50 text-xs text-red-700">{loadError}</div>
                        )}
                    </div>
                )}
            </div>

            {activeTab === 'USP' && <UspPanel models={models} />}

            {activeTab === 'MODELS' && actionError && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center justify-between">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-700 p-0.5" aria-label="Tutup">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {activeTab === 'MODELS' && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1080px]">
                        <thead className="bg-gray-50/90 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="text-left py-3 px-4 w-16">ID</th>
                                <th className="text-left py-3 px-4 min-w-[160px]">Model Name</th>
                                <th className="text-left py-3 px-4 w-28">Model No</th>
                                <th className="text-left py-3 px-4 min-w-[240px]">Articles</th>
                                <th className="text-left py-3 px-4 w-32">Photo</th>
                                <th className="text-left py-3 px-4 w-32">Int. Audit</th>
                                <th className="text-right py-3 px-4 w-[250px] sticky right-0 bg-gray-50 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {models.map(m => (
                                <tr key={m.setupModelId} className={`transition-colors group ${editingModelId === m.setupModelId ? 'bg-blue-50/40' : 'hover:bg-gray-50/80'}`}>
                                    <td className="py-2.5 px-4 text-gray-500 font-mono text-xs">{m.setupModelId}</td>
                                    {editingModelId === m.setupModelId ? (
                                        <td colSpan={3} className="py-2.5 px-4 text-gray-800">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingModelName}
                                                    onChange={e => setEditingModelName(e.target.value)}
                                                    placeholder="Model name"
                                                    className="flex-1 min-w-[180px] border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                                                />
                                                <input
                                                    type="text"
                                                    value={editingModelNo}
                                                    onChange={e => setEditingModelNo(e.target.value)}
                                                    placeholder="Model No"
                                                    className="w-28 border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                                                />
                                                <input
                                                    type="text"
                                                    value={editingArticles}
                                                    onChange={e => setEditingArticles(e.target.value)}
                                                    placeholder="Articles, comma separated"
                                                    className="flex-1 min-w-[180px] border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                                                />
                                                <button
                                                    onClick={() => addArticlesFromPo(m.setupModelId)}
                                                    disabled={poArticlesLoading}
                                                    title="Tambahkan artikel dari Purchase Orders dengan nama model ini"
                                                    className="text-xs text-gray-700 border border-gray-200 bg-white px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                    {poArticlesLoading ? 'Memuat...' : 'Ambil dari PO'}
                                                </button>
                                                <button onClick={() => handleSaveModel(m.setupModelId)} className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700">Save</button>
                                                <button onClick={() => setEditingModelId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                                            </div>
                                            {editNote && <p className="mt-1 text-xs text-emerald-700">{editNote}</p>}
                                            {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
                                        </td>
                                    ) : (
                                        <>
                                            <td className="py-2.5 px-4 font-medium text-gray-900">{m.modelName}</td>
                                            <td className="py-2.5 px-4 font-mono text-xs">
                                                {m.modelNo
                                                    ? <span className="text-gray-800 font-semibold">{m.modelNo}</span>
                                                    : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                {(m.articles || []).length > 0 ? (() => {
                                                    const all = m.articles.map((a: any) => a.article);
                                                    const open = expandedArticles.has(m.setupModelId);
                                                    const shown = open ? all : all.slice(0, ARTICLES_FOLDED);
                                                    return (
                                                        <div className="flex flex-wrap gap-1">
                                                            {shown.map((a: string) => (
                                                                <span key={a} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">{a}</span>
                                                            ))}
                                                            {all.length > ARTICLES_FOLDED && (
                                                                <button
                                                                    onClick={() => toggleArticles(m.setupModelId)}
                                                                    className="px-1.5 py-0.5 rounded text-[11px] text-blue-600 hover:bg-blue-50"
                                                                >
                                                                    {open ? 'Ringkas' : `+${all.length - ARTICLES_FOLDED} lagi`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })() : (
                                                    <span className={`font-mono text-xs ${nameCounts[m.modelName] > 1 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                        {nameCounts[m.modelName] > 1 ? 'Add articles: name is shared' : '-'}
                                                    </span>
                                                )}
                                            </td>
                                        </>
                                    )}
                                    <td className="py-2.5 px-4 text-gray-800">
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
                                    <td className="py-2.5 px-4 text-gray-800">
                                        {m.internalAuditFile ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleViewFile(m.internalAuditFile)} className="text-xs text-blue-800 hover:underline font-semibold bg-gray-100 border border-gray-200 px-2.5 py-1 rounded">
                                                    👁 View
                                                </button>
                                                <a href={m.internalAuditFile} download={`Audit_${m.modelName}${m.modelNo ? `_${m.modelNo}` : ''}`} className="text-xs text-blue-800 hover:underline font-semibold bg-blue-50 border border-blue-100 px-2.5 py-1 rounded">
                                                    ↓ Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className={`py-2.5 px-4 text-right sticky right-0 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)] transition-colors ${editingModelId === m.setupModelId ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                                        {/* Same action buttons as the Master Data lists; the column stays in view
                                            when a narrow screen scrolls the table sideways */}
                                        <div className="inline-flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => router.push(`/admin/setup/tree/${m.setupModelId}`)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded transition-colors"
                                                title={`Atur Area / Process / Defect ${modelLabel(m)}`}
                                            >
                                                <Settings2 className="w-3 h-3" />
                                                Configure
                                            </button>
                                            <button
                                                onClick={() => startEdit(m)}
                                                disabled={editingModelId === m.setupModelId}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                title={`Edit ${modelLabel(m)}`}
                                            >
                                                <Edit2 className="w-3 h-3" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteModel(m)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition-colors"
                                                title={`Hapus ${modelLabel(m)}`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {models.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">No models configured yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
        </div>
    );
}
