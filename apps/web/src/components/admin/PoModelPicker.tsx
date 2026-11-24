'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { modelLabel } from '../../lib/model-label';
import { fetchPoArticles, searchPoModels, type PoArticleOption, type PoModelOption } from '../../lib/po-models';
import { mergeUspNames, splitUspNames } from '../../lib/usp-names';
import UspTagsInput from './UspTagsInput';

// "Add Model" form of Setup CTQ: the model name and its articles come from the Purchase Orders,
// so they match the PO / TQC data exactly. The USPs and the Model No (not in the POs) are typed.
export default function PoModelPicker({ models, onCreated }: { models: any[]; onCreated: () => void }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<PoModelOption[]>([]);
    const [optionsTruncated, setOptionsTruncated] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [optionsError, setOptionsError] = useState('');
    const [highlight, setHighlight] = useState(0);

    const [selected, setSelected] = useState<PoModelOption | null>(null);
    const [articles, setArticles] = useState<PoArticleOption[]>([]);
    const [articlesTruncated, setArticlesTruncated] = useState(false);
    const [articlesLoading, setArticlesLoading] = useState(false);
    const [checked, setChecked] = useState<Set<string>>(new Set());

    const [modelNo, setModelNo] = useState('');
    const [usps, setUsps] = useState<string[]>([]);
    const [uspDraft, setUspDraft] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const wrapRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Article -> the Setup CTQ model that already owns it (an article belongs to one model only)
    const takenBy = useMemo(() => {
        const map = new Map<string, string>();
        for (const m of models) for (const a of m.articles || []) map.set(String(a.article).toUpperCase(), modelLabel(m));
        return map;
    }, [models]);

    const setupCountByName = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const m of models) counts[m.modelName] = (counts[m.modelName] || 0) + 1;
        return counts;
    }, [models]);

    // Search the PO model names while the list is open (debounced)
    useEffect(() => {
        if (!open) return;
        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            setOptionsLoading(true);
            setOptionsError('');
            try {
                const { models: found, truncated } = await searchPoModels(query, ctrl.signal);
                setOptions(found);
                setOptionsTruncated(truncated);
                setHighlight(0);
            } catch (e: any) {
                if (e.name !== 'AbortError') setOptionsError(e.message);
            } finally {
                if (!ctrl.signal.aborted) setOptionsLoading(false);
            }
        }, 250);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [query, open]);

    // Close the list on a click outside
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Keep the highlighted option in view while moving with the arrow keys
    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight]);

    const pick = async (opt: PoModelOption) => {
        setSelected(opt);
        setQuery(opt.name);
        setOpen(false);
        setError('');
        setArticles([]);
        setChecked(new Set());
        setArticlesLoading(true);
        try {
            const { articles: found, truncated } = await fetchPoArticles(opt.variants);
            setArticles(found);
            setArticlesTruncated(truncated);
            // Every article not yet owned by another model is ticked
            setChecked(new Set(found.filter(a => !takenBy.has(a.article)).map(a => a.article)));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setArticlesLoading(false);
        }
    };

    const clearSelection = () => {
        setSelected(null);
        setQuery('');
        setArticles([]);
        setChecked(new Set());
        setModelNo('');
        setUsps([]);
        setUspDraft('');
        setError('');
    };

    const toggleArticle = (article: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(article)) next.delete(article); else next.add(article);
            return next;
        });
    };

    const freeArticles = articles.filter(a => !takenBy.has(a.article));

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) setOpen(true);
            else setHighlight(h => Math.min(h + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            if (open) {
                e.preventDefault();
                if (options[highlight]) pick(options[highlight]);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected) {
            setError('Pilih model dari daftar Purchase Orders.');
            setOpen(true);
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/ctq-setup/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName: selected.name,
                    modelNo: modelNo.trim().toUpperCase(),
                    articles: [...checked],
                    // A name still in the box counts too, so Add Model doesn't drop what was typed without Enter
                    usps: mergeUspNames(usps, splitUspNames(uspDraft)),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const msg = data?.message;
                throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg || `Gagal menambah model (${res.status}).`));
            }
            clearSelection();
            onCreated();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const existingSameName = selected ? setupCountByName[selected.name] || 0 : 0;

    return (
        <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Same order as the models table: name, USP, Model No. Top-aligned so the USP box can grow */}
            <div className="flex flex-col md:flex-row md:items-start gap-2">
                {/* Model name: searchable list of the model names found in the Purchase Orders */}
                <div ref={wrapRef} className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelected(null); setArticles([]); setChecked(new Set()); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={onKeyDown}
                        type="text"
                        role="combobox"
                        aria-expanded={open}
                        aria-controls="po-model-options"
                        aria-autocomplete="list"
                        autoComplete="off"
                        placeholder="Cari model dari Purchase Orders..."
                        className={`admin-input pl-9 pr-14 ${selected ? '!border-emerald-300 !bg-emerald-50/40 font-medium' : ''}`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {query && (
                            <button type="button" onClick={clearSelection} className="p-0.5 text-gray-400 hover:text-gray-700 rounded" title="Hapus pilihan">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button type="button" onClick={() => setOpen(o => !o)} className="p-0.5 text-gray-400 hover:text-gray-700 rounded" tabIndex={-1} aria-label="Tampilkan daftar model">
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    {open && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                            <div className="px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-100 flex items-center justify-between">
                                <span>Model di Purchase Orders</span>
                                {optionsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            </div>
                            {optionsError ? (
                                <p className="px-3 py-3 text-xs text-red-600">{optionsError}</p>
                            ) : options.length === 0 && !optionsLoading ? (
                                <p className="px-3 py-3 text-xs text-gray-400">Tidak ada model PO yang cocok.</p>
                            ) : (
                                <ul id="po-model-options" ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
                                    {options.map((opt, idx) => {
                                        const inSetup = setupCountByName[opt.name] || 0;
                                        return (
                                            <li
                                                key={opt.name}
                                                data-idx={idx}
                                                role="option"
                                                aria-selected={idx === highlight}
                                                onMouseDown={e => { e.preventDefault(); pick(opt); }}
                                                onMouseEnter={() => setHighlight(idx)}
                                                className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between gap-3 ${idx === highlight ? 'bg-gray-100' : ''}`}
                                            >
                                                <span className="truncate text-gray-800">{opt.name}</span>
                                                <span className="flex items-center gap-1.5 flex-shrink-0">
                                                    {inSetup > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                            sudah di Setup{inSetup > 1 ? ` ×${inSetup}` : ''}
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] text-gray-400 font-mono">{opt.poCount} PO</span>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {optionsTruncated && (
                                <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">Daftar dipotong. Ketik nama model untuk mempersempit.</p>
                            )}
                        </div>
                    )}
                </div>
                <UspTagsInput
                    names={usps}
                    onNamesChange={setUsps}
                    draft={uspDraft}
                    onDraftChange={setUspDraft}
                    placeholder="USP (opsional), Enter untuk tambah"
                    className="flex-1 min-w-0"
                />
                <input
                    value={modelNo}
                    onChange={e => setModelNo(e.target.value)}
                    type="text"
                    placeholder="Model No (opsional)"
                    aria-label="Model No"
                    className="admin-input md:w-44 font-mono"
                />
                <button
                    type="submit"
                    disabled={saving || !selected || articlesLoading}
                    className="admin-btn admin-btn-primary"
                >
                    {saving ? 'Menyimpan...' : 'Add Model'}
                </button>
            </div>

            {selected && (
                <div className="border border-gray-200 rounded-md bg-gray-50/60">
                    <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200">
                        <p className="text-xs text-gray-600">
                            Artikel di PO untuk <strong className="text-gray-900">{selected.name}</strong>
                            <span className="text-gray-400"> · {selected.poCount} PO</span>
                            {!articlesLoading && <span className="text-gray-400"> · {checked.size}/{articles.length} dipilih</span>}
                        </p>
                        {freeArticles.length > 1 && (
                            <div className="flex items-center gap-2 text-[11px]">
                                <button type="button" onClick={() => setChecked(new Set(freeArticles.map(a => a.article)))} className="text-blue-600 hover:underline">Pilih semua</button>
                                <button type="button" onClick={() => setChecked(new Set())} className="text-gray-500 hover:underline">Kosongkan</button>
                            </div>
                        )}
                    </div>
                    <div className="px-3 py-2 max-h-36 overflow-y-auto">
                        {articlesLoading ? (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat artikel...</p>
                        ) : articles.length === 0 ? (
                            <p className="text-xs text-gray-400">Tidak ada artikel di PO untuk model ini.</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {articles.map(a => {
                                    const owner = takenBy.get(a.article);
                                    const isChecked = checked.has(a.article);
                                    return (
                                        <label
                                            key={a.article}
                                            title={owner ? `Sudah dipakai oleh ${owner}` : `${a.poCount} PO`}
                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono ${owner
                                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : isChecked
                                                    ? 'border-gray-900 bg-white text-gray-900 cursor-pointer'
                                                    : 'border-gray-200 bg-white text-gray-500 cursor-pointer hover:border-gray-400'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="w-3 h-3 accent-gray-900"
                                                checked={isChecked}
                                                disabled={!!owner}
                                                onChange={() => toggleArticle(a.article)}
                                            />
                                            {a.article}
                                            <span className="text-[10px] text-gray-400 font-sans">{owner ? `dipakai ${owner}` : `${a.poCount} PO`}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        {articlesTruncated && <p className="mt-1.5 text-[11px] text-amber-600">Artikel terlalu banyak; hanya 200 pertama yang tampil.</p>}
                    </div>
                </div>
            )}

            {selected && existingSameName > 0 && (
                <p className="text-xs text-amber-700">
                    Sudah ada {existingSameName} model bernama {selected.name} di Setup CTQ. Isi Model No dan pilih artikelnya, agar PO dan TQC tertaut ke model yang benar.
                </p>
            )}
            <p
                className="text-xs text-gray-400 truncate"
                title="Nama model dan artikel diambil dari Purchase Orders. USP bisa lebih dari satu: ketik lalu Enter, atau tempel daftar (satu nama per baris). Artikel yang dicentang menautkan PO dan TQC ke model ini; artikel baru di PO berikutnya bisa ditambahkan lewat Edit → Ambil dari PO. Tanpa artikel, PO dicocokkan berdasarkan nama model."
            >
                Nama model dan artikel diambil dari Purchase Orders. USP: ketik lalu Enter, atau tempel daftar (satu nama per baris). Arahkan kursor untuk penjelasan lengkap.
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
    );
}
