'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { Check, Edit2, Settings2, Trash2, X } from 'lucide-react';
import { compressImage } from '../../../lib/compress-image';
import { modelLabel } from '../../../lib/model-label';
import { fetchPoArticlesForModelName } from '../../../lib/po-models';
import PoModelPicker from '../../../components/admin/PoModelPicker';
import UspTagsInput from '../../../components/admin/UspTagsInput';
import { mergeUspNames, sameUspName, splitUspNames } from '../../../lib/usp-names';

// Long lists show this many chips until expanded
const ARTICLES_FOLDED = 8;
const USPS_FOLDED = 4;

export default function SetupCtqPage() {
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loadError, setLoadError] = useState('');
    const [editingModelId, setEditingModelId] = useState<string | null>(null);
    const [editingModelName, setEditingModelName] = useState('');
    const [editingModelNo, setEditingModelNo] = useState('');
    const [editingArticles, setEditingArticles] = useState('');
    // USP names of the model being edited; saved with the row (added / removed on Save)
    const [editingUsps, setEditingUsps] = useState<string[]>([]);
    const [uspDraft, setUspDraft] = useState('');
    const [editError, setEditError] = useState('');
    const [editNote, setEditNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [poArticlesLoading, setPoArticlesLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    // Article / USP lists shown in full ("a:<id>", "u:<id>"); long lists start folded
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggleExpanded = (key: string) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
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

    useEffect(() => {
        // The USP tab became the USP column; drop a leftover ?tab=usp from old links
        if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
        fetchModels();
    }, []);

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
        setEditingUsps((m.masterUsps || []).map((u: any) => u.uspName));
        setUspDraft('');
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

    const handleSaveModel = async (m: any) => {
        if (!editingModelName.trim()) return setEditError('Model Name is required.');
        // A name still in the box counts too, so Save doesn't drop what was typed without Enter
        const usps = mergeUspNames(editingUsps, splitUspNames(uspDraft));
        const removed = (m.masterUsps || [])
            .map((u: any) => u.uspName as string)
            .filter((name: string) => !usps.some(n => sameUspName(n, name)));
        if (removed.length > 0 && !window.confirm(
            `Hapus USP: ${removed.join(', ')}?\nProcess yang dikelompokkan ke USP ini jadi tanpa USP grouping.`,
        )) return;

        setSaving(true);
        setEditError('');
        try {
            const res = await fetch(`/api/ctq-setup/models/${m.setupModelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName: editingModelName.trim().toUpperCase(),
                    modelNo: editingModelNo.trim().toUpperCase(),
                    articles: parseArticles(editingArticles),
                    usps,
                })
            });
            if (!res.ok) {
                setEditError(await readError(res));
                return;
            }
            setEditingModelId(null);
            fetchModels();
        } catch (e: any) {
            setEditError(e.message || 'Gagal menyimpan model.');
        } finally {
            setSaving(false);
        }
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

    const inputClass = 'border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 bg-white';

    return (
        <div className="space-y-5">
            {/* Title and the Add Model form stay at the top while the list scrolls */}
            <div className="admin-sticky-head space-y-3">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900">CTQ Setup</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Define model hierarchies: Model &rarr; Area &rarr; Process &rarr; Defect.
                        <span className="ml-2 px-1.5 rounded-full text-[10px] font-mono bg-gray-200 text-gray-700 align-middle">{models.length} model</span>
                    </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <PoModelPicker models={models} onCreated={fetchModels} />
                    {loadError && (
                        <div className="px-3 py-2 rounded border border-red-200 bg-red-50 text-xs text-red-700">{loadError}</div>
                    )}
                </div>
            </div>

            {actionError && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center justify-between">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-700 p-0.5" aria-label="Tutup">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1280px]">
                        <thead className="bg-gray-50/90 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="text-left py-3 px-4 w-16">ID</th>
                                <th className="text-left py-3 px-4 min-w-[160px]">Model Name</th>
                                <th className="text-left py-3 px-4 min-w-[200px]">USP</th>
                                <th className="text-left py-3 px-4 w-28">Model No</th>
                                <th className="text-left py-3 px-4 min-w-[240px]">Articles</th>
                                <th className="text-left py-3 px-4 w-32">Photo</th>
                                <th className="text-left py-3 px-4 w-32">Int. Audit</th>
                                <th className="text-right py-3 px-4 w-[250px] sticky right-0 bg-gray-50 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {models.map(m => {
                                const isEditing = editingModelId === m.setupModelId;
                                return (
                                    <Fragment key={m.setupModelId}>
                                        <tr className={`transition-colors group ${isEditing ? 'bg-blue-50/40 align-top' : 'hover:bg-gray-50/80'}`}>
                                            <td className="py-2.5 px-4 text-gray-500 font-mono text-xs">{m.setupModelId}</td>
                                            {isEditing ? (
                                                <>
                                                    <td className="py-2.5 px-4">
                                                        <input
                                                            type="text"
                                                            value={editingModelName}
                                                            onChange={e => setEditingModelName(e.target.value)}
                                                            placeholder="Model name"
                                                            className={`w-full min-w-[150px] ${inputClass}`}
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <UspTagsInput
                                                            names={editingUsps}
                                                            onNamesChange={setEditingUsps}
                                                            draft={uspDraft}
                                                            onDraftChange={setUspDraft}
                                                            className="min-w-[190px]"
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <input
                                                            type="text"
                                                            value={editingModelNo}
                                                            onChange={e => setEditingModelNo(e.target.value)}
                                                            placeholder="Model No"
                                                            className={`w-24 font-mono ${inputClass}`}
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingArticles}
                                                                onChange={e => setEditingArticles(e.target.value)}
                                                                placeholder="Articles, comma separated"
                                                                className={`flex-1 min-w-[180px] font-mono ${inputClass}`}
                                                            />
                                                            <button
                                                                onClick={() => addArticlesFromPo(m.setupModelId)}
                                                                disabled={poArticlesLoading}
                                                                title="Tambahkan artikel dari Purchase Orders dengan nama model ini"
                                                                className="text-xs text-gray-700 border border-gray-200 bg-white px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                                                            >
                                                                {poArticlesLoading ? 'Memuat...' : 'Ambil dari PO'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="py-2.5 px-4 font-medium text-gray-900">{m.modelName}</td>
                                                    <td className="py-2.5 px-4">
                                                        {(m.masterUsps || []).length > 0 ? (() => {
                                                            const all: any[] = m.masterUsps;
                                                            const key = `u:${m.setupModelId}`;
                                                            const open = expanded.has(key);
                                                            const shown = open ? all : all.slice(0, USPS_FOLDED);
                                                            return (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {shown.map(u => (
                                                                        <span
                                                                            key={u.uspId}
                                                                            title={u.isActive ? u.uspName : `${u.uspName} (nonaktif)`}
                                                                            className={`px-1.5 py-0.5 rounded border text-[11px] font-medium ${u.isActive
                                                                                ? 'border-blue-100 bg-blue-50 text-blue-800'
                                                                                : 'border-gray-200 bg-gray-50 text-gray-400 line-through'}`}
                                                                        >
                                                                            {u.uspName}
                                                                        </span>
                                                                    ))}
                                                                    {all.length > USPS_FOLDED && (
                                                                        <button onClick={() => toggleExpanded(key)} className="px-1.5 py-0.5 rounded text-[11px] text-blue-600 hover:bg-blue-50">
                                                                            {open ? 'Ringkas' : `+${all.length - USPS_FOLDED} lagi`}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })() : <span className="text-xs text-gray-400">-</span>}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-mono text-xs">
                                                        {m.modelNo
                                                            ? <span className="text-gray-800 font-semibold">{m.modelNo}</span>
                                                            : <span className="text-gray-400">-</span>}
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        {(m.articles || []).length > 0 ? (() => {
                                                            const all = m.articles.map((a: any) => a.article);
                                                            const key = `a:${m.setupModelId}`;
                                                            const open = expanded.has(key);
                                                            const shown = open ? all : all.slice(0, ARTICLES_FOLDED);
                                                            return (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {shown.map((a: string) => (
                                                                        <span key={a} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">{a}</span>
                                                                    ))}
                                                                    {all.length > ARTICLES_FOLDED && (
                                                                        <button onClick={() => toggleExpanded(key)} className="px-1.5 py-0.5 rounded text-[11px] text-blue-600 hover:bg-blue-50">
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
                                            <td className={`py-2.5 px-4 text-right sticky right-0 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)] transition-colors ${isEditing ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                                                {isEditing ? (
                                                    <div className="inline-flex gap-1.5">
                                                        <button
                                                            onClick={() => handleSaveModel(m)}
                                                            disabled={saving}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                                                        >
                                                            <Check className="w-3 h-3" />
                                                            {saving ? 'Menyimpan...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingModelId(null)}
                                                            disabled={saving}
                                                            className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    /* Same action buttons as the Master Data lists; the column stays in view
                                                       when a narrow screen scrolls the table sideways */
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
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors"
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
                                                )}
                                            </td>
                                        </tr>
                                        {isEditing && (editNote || editError) && (
                                            <tr className="bg-blue-50/40">
                                                <td />
                                                <td colSpan={7} className="pb-2.5 px-4 -mt-1">
                                                    {editNote && <p className="text-xs text-emerald-700">{editNote}</p>}
                                                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                            {models.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-gray-400 text-sm">No models configured yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
