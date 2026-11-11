'use client';

// CAP Report of a model: the weekly CAPs (a defect in a process above 5% over the week, Mon-Sun),
// split into "Belum Diinput" and "Sudah Diinput". The four stages of a CAP are filled in here.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDays, CAP_STAGES, isWeeklyCap, weekStart, type WeeklyCapItem } from '../../../lib/cap-weekly';
import { getJson, savePhoto, saveProcess } from '../../../lib/offline/inspection-repository';
import { compressImage } from '../../../lib/compress-image';
import { processImageUrl } from '../../../lib/image-url';
import { formatRate } from '../../../lib/format-rate';
import { triggerRefresh } from '../../../lib/use-data-refresh';

const fmtDay = (day: string, withYear = false) =>
    new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

export function CapReport({ modelId, items }: { modelId: string; items: WeeklyCapItem[] }) {
    // Names of area / process / defect come from the model's CTQ tree
    const [tree, setTree] = useState<any[]>([]);
    useEffect(() => {
        getJson<any>(`/api/ctq-setup/models/${modelId}/tree`).then(t => setTree(t?.areas || [])).catch(() => { /* names fall back to ids */ });
    }, [modelId]);

    const names = useMemo(() => {
        const m = new Map<string, { area: string; process: string; defect: string }>();
        tree.forEach(a => a.setupProcesses?.forEach((p: any) => p.setupDefects?.forEach((d: any) =>
            m.set(`${p.setupProcessId}|${d.defectId}`, {
                area: a.masterArea?.area || '', process: p.masterProcess?.process || '', defect: d.masterDefect?.defect || '',
            }))));
        return m;
    }, [tree]);

    const thisWeek = weekStart(new Date().toISOString().slice(0, 10));
    const [week, setWeek] = useState(thisWeek);
    const [open, setOpen] = useState<WeeklyCapItem | null>(null);

    const weekItems = useMemo(
        () => items.filter(i => i.week === week && isWeeklyCap(i)).sort((a, b) => b.rate - a.rate),
        [items, week],
    );
    const pending = weekItems.filter(i => i.progress === 0);
    const started = weekItems.filter(i => i.progress > 0);

    const label = (it: WeeklyCapItem) => {
        const n = names.get(`${it.setupProcessId}|${it.defectId}`);
        return { defect: n?.defect || `Defect #${it.defectId}`, where: [n?.area, n?.process].filter(Boolean).join(' - ') || `Process #${it.setupProcessId}` };
    };

    const Card = ({ it }: { it: WeeklyCapItem }) => {
        const l = label(it);
        const complete = it.progress === CAP_STAGES.length;
        const none = it.progress === 0;
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-bold text-[#0E2947] text-sm uppercase leading-tight">{l.defect}</p>
                    <p className="text-[11px] text-gray-500 uppercase mt-0.5 leading-tight">{l.where}</p>
                    <p className="text-[11px] text-gray-600 mt-1">Weekly Defect Rate: <b className="text-red-600">{formatRate(it.rate * 100)}</b></p>
                    {!none && <p className="text-[11px] text-gray-500 mt-0.5">Progress CAP: {it.progress}/{CAP_STAGES.length} tahap</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {!none && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${complete ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {complete ? 'Completed' : 'In Progress'}
                        </span>
                    )}
                    <button
                        onClick={() => setOpen(it)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-colors ${none ? 'bg-[#0E2947] text-white hover:bg-[#091E35]' : 'border border-[#0E2947] text-[#0E2947] hover:bg-[#0E2947]/5'}`}
                    >
                        {none ? 'INPUT CAP' : complete ? 'VIEW CAP' : 'CONTINUE CAP'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Week picker: CAP is judged per week (Mon-Sun) */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm">
                <button onClick={() => setWeek(addDays(week, -7))} className="p-1.5 text-gray-500 hover:text-gray-900" aria-label="Minggu sebelumnya"><ChevronLeft className="w-5 h-5" /></button>
                <div className="text-center leading-tight">
                    <p className="text-sm font-bold text-gray-900">{fmtDay(week)} – {fmtDay(addDays(week, 6), true)}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{week === thisWeek ? 'Minggu ini' : 'Weekly CAP (rate > 5%)'}</p>
                </div>
                <button onClick={() => setWeek(addDays(week, 7))} disabled={week >= thisWeek} className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Minggu berikutnya"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {weekItems.length === 0 ? (
                <div className="text-center py-10 mt-3 bg-white border border-gray-200 border-dashed rounded-xl">
                    <p className="text-gray-500 text-sm">Tidak ada defect di atas 5% pada minggu ini.</p>
                </div>
            ) : (
                <div className="mt-3 space-y-4">
                    {pending.length > 0 && (
                        <section>
                            <h3 className="text-sm font-bold text-[#0E2947] mb-2">Belum Diinput</h3>
                            <div className="space-y-2">{pending.map(it => <Card key={it.key} it={it} />)}</div>
                        </section>
                    )}
                    {started.length > 0 && (
                        <section className={pending.length > 0 ? 'pt-3 border-t border-gray-200' : ''}>
                            <h3 className="text-sm font-bold text-[#0E2947] mb-2">Sudah Diinput</h3>
                            <div className="space-y-2">{started.map(it => <Card key={it.key} it={it} />)}</div>
                        </section>
                    )}
                </div>
            )}

            {open && <CapForm item={open} title={label(open)} onClose={() => setOpen(null)} />}
        </div>
    );
}

/** The four CAP stages of one weekly item, saved on its newest inspection row. */
function CapForm({ item, title, onClose }: { item: WeeklyCapItem; title: { defect: string; where: string }; onClose: () => void }) {
    const target = item.rows[0]; // newest audit that has this defect
    const [rootCause, setRootCause] = useState(item.values.rootCause);
    const [corrective, setCorrective] = useState(item.values.corrective);
    const [photoDefect, setPhotoDefect] = useState<File | null>(null);
    const [photoAfter, setPhotoAfter] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const pick = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.files?.[0] ?? null);
    const preview = (file: File | null, stored: string) => (file ? URL.createObjectURL(file) : stored ? processImageUrl(stored) : '');

    const save = async () => {
        setSaving(true);
        try {
            const headerId = target.header.rqcHeaderId;
            const up = (f: File | null) => (f ? compressImage(f).then(b => savePhoto(headerId, b)) : Promise.resolve(undefined));
            const [pd, pa] = await Promise.all([up(photoDefect), up(photoAfter)]);
            await saveProcess(headerId, item.setupAreaId, item.setupProcessId, {
                qtyChecking: target.process.qtyChecking,
                defects: [{
                    defectId: item.defectId,
                    qtyDefect: target.insp.qtyDefect,
                    rootCause: rootCause.trim() || undefined,
                    corrective: corrective.trim() || undefined,
                    photoDefect: pd,
                    photoAfterActionPlan: pa,
                }],
            } as any, { processName: title.where });
            onClose();
            triggerRefresh(); // same as the header's Refresh: the report reloads its audits
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan CAP.');
            setSaving(false);
        }
    };

    const Photo = ({ label, file, stored, setter }: { label: string; file: File | null; stored: string; setter: (f: File | null) => void }) => {
        const src = preview(file, stored);
        return (
            <div>
                <p className="text-xs font-bold text-gray-700 mb-1">{label}</p>
                <label className="block cursor-pointer">
                    {src ? (
                        <img src={src} alt={label} className="w-full h-36 object-cover rounded-lg border border-gray-200" />
                    ) : (
                        <div className="h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500">Ambil / pilih foto</div>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick(setter)} />
                </label>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-[#0E2947] text-white px-4 py-3 flex items-start justify-between rounded-t-2xl">
                    <div className="min-w-0">
                        <p className="font-bold text-sm uppercase leading-tight">{title.defect}</p>
                        <p className="text-[11px] text-blue-200/80 uppercase leading-tight">{title.where} · {formatRate(item.rate * 100)}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-300 hover:text-white" aria-label="Tutup"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <Photo label="1. Foto defect" file={photoDefect} stored={item.values.photoDefect} setter={setPhotoDefect} />
                    <label className="block">
                        <span className="text-xs font-bold text-gray-700">2. Root cause</span>
                        <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} rows={3} className="mt-1 w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:border-[#F5A623]" />
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-gray-700">3. Corrective action</span>
                        <textarea value={corrective} onChange={e => setCorrective(e.target.value)} rows={3} className="mt-1 w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:border-[#F5A623]" />
                    </label>
                    <Photo label="4. Foto setelah action" file={photoAfter} stored={item.values.photoAfterActionPlan} setter={setPhotoAfter} />
                    <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-[#F5A623] text-[#0E2947] font-bold disabled:opacity-60">
                        {saving ? 'Menyimpan...' : 'Simpan CAP'}
                    </button>
                </div>
            </div>
        </div>
    );
}
