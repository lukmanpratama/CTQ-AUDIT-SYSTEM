'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';
import { modelLabel } from '../../../../lib/model-label';
import { useDataRefresh } from '../../../../lib/use-data-refresh';
import { deleteHeader, listHeaders } from '../../../../lib/offline/inspection-repository';
import { inspectorSessionUrl, inspectorSummaryUrl } from '../../../../features/rqc/audit-nav';
import { missingFollowUp } from '../../../../lib/followup';

function ActionBadge({ label, filled, total }: { label: string; filled: number; total: number }) {
    if (total === 0) return null;
    const done = filled >= total;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${done ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
            title={done ? `${label} sudah lengkap semua` : `${total - filled} ${label} belum lengkap`}
        >
            {done ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01" /></svg>
            )}
            {label}: {done ? 'Lengkap' : 'Belum lengkap'} ({filled}/{total})
        </span>
    );
}

type StatusFilter = 'ALL' | 'IA' | 'CAP' | 'NO_DEFECT';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'Semua' },
    { value: 'IA', label: 'Immediate' },
    { value: 'CAP', label: 'CAP' },
    { value: 'NO_DEFECT', label: 'Tanpa Defect' },
];

/** Checks, defects and Immediate Action / CAP follow-up counts of one audit. */
function summarize(h: any) {
    let checks = 0;
    let defects = 0;
    // Follow-up status: complete when every part is filled in, photos included (lib/followup.ts)
    const ia = { total: 0, filled: 0 };
    const cap = { total: 0, filled: 0 };
    h.rqcAreas?.forEach((a: any) => {
        a.rqcProcesses?.forEach((p: any) => {
            checks += p.qtyChecking || 0;
            p.rqcInspections?.forEach((i: any) => {
                defects += i.qtyDefect || 0;
                if (!(i.qtyDefect > 0)) return;
                if (i.status === 'CAP') {
                    cap.total++;
                    if (missingFollowUp(i).length === 0) cap.filled++;
                } else if (i.status === 'IMMEDIATE_ACTION' || i.status === 'IA') {
                    ia.total++;
                    if (missingFollowUp(i).length === 0) ia.filled++;
                }
            });
        });
    });
    return { checks, defects, ia, cap };
}

const matchesStatus = (s: ReturnType<typeof summarize>, status: StatusFilter) =>
    status === 'ALL'
    || (status === 'IA' && s.ia.total > 0)
    || (status === 'CAP' && s.cap.total > 0)
    || (status === 'NO_DEFECT' && s.ia.total === 0 && s.cap.total === 0);

export default function RqcModelHistoryPage({ params }: { params: Promise<{ modelId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const modelId = resolvedParams.modelId;

    const [loading, setLoading] = useState(true);
    const [headers, setHeaders] = useState<any[]>([]);

    // Reload when someone adds / changes data (the loading screen only shows on the first load)
    const { refreshKey } = useDataRefresh();
    useEffect(() => {
        // Offline: the list kept on this device, plus audits made / changed offline
        listHeaders(modelId)
            .then(data => {
                setHeaders(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load headers', err);
                setLoading(false);
            });
    }, [modelId, refreshKey]);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState<StatusFilter>('ALL');

    // Newest audit date first, each with its totals and follow-up status
    const audits = useMemo(() => (Array.isArray(headers) ? headers : [])
        .map(h => ({ h, s: summarize(h), day: String(h.date).slice(0, 10) }))
        .sort((a, b) => b.day.localeCompare(a.day) || String(b.h.createdAt).localeCompare(String(a.h.createdAt))),
        [headers]);

    const inDateRange = (day: string) => (!startDate || day >= startDate) && (!endDate || day <= endDate);
    const datedAudits = audits.filter(a => inDateRange(a.day));
    const visibleAudits = datedAudits.filter(a => matchesStatus(a.s, status));
    const hasFilter = !!startDate || !!endDate || status !== 'ALL';

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-28 relative">
            {/* Top Navigation Bar */}
            <nav className="bg-white px-4 h-14 flex items-center justify-between shadow-sm sticky top-0 z-20">
                <button onClick={() => router.push('/dashboard')} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Dashboard
                </button>
            </nav>

            {/* No overflow here: the window scrolls, which is what keeps the filter panel sticky */}
            <div className="flex-1 p-5 max-w-2xl mx-auto w-full">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Inspection History</h1>
                <p className="text-sm text-gray-500 mb-6">Past records for this model.</p>

                {loading ? (
                    <p className="text-gray-500 text-sm animate-pulse text-center mt-10">Loading records...</p>
                ) : headers.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 border border-gray-200 border-dashed rounded-xl mt-4">
                        <p className="text-gray-500 text-sm mb-2">Belum ada riwayat inspeksi.</p>
                    </div>
                ) : (
                    <>
                        {headers.length > 0 && headers[0].setupModel?.modelName && (
                            <p className="text-xs font-bold text-gray-800 bg-gray-100 uppercase tracking-widest inline-block px-3 py-1 rounded-full mb-4">
                                {modelLabel(headers[0].setupModel)}
                            </p>
                        )}

                        {/* Filters stay pinned under the top bar while the list scrolls (top-14 = nav height) */}
                        <div className="sticky top-14 z-10 -mx-5 px-5 pt-2 pb-3 bg-gray-50/95 backdrop-blur">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                {/* Date range */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                                    {[
                                        { label: 'Dari', value: startDate, set: setStartDate, min: undefined, max: endDate || undefined },
                                        { label: 'Sampai', value: endDate, set: setEndDate, min: startDate || undefined, max: undefined },
                                    ].map(d => (
                                        <div key={d.label} className="flex flex-col px-3 py-2 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{d.label}</span>
                                                {/* iOS's own "Reset" in the date picker restores the input's default value,
                                                    which React keeps equal to the chosen date, so it never cleared it */}
                                                {d.value && (
                                                    <button
                                                        type="button"
                                                        onClick={() => d.set('')}
                                                        className="-my-1 -mr-1 px-1.5 text-sm leading-none text-gray-400 hover:text-gray-900"
                                                        aria-label={`Hapus tanggal ${d.label}`}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="date"
                                                value={d.value}
                                                min={d.min}
                                                max={d.max}
                                                onChange={e => d.set(e.target.value)}
                                                className="w-full min-w-0 h-7 bg-transparent text-sm font-medium text-gray-900 outline-none appearance-none"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Follow-up status: one equal-width segment each; counts follow the date range */}
                                <div className="grid grid-cols-4 gap-1 p-1.5">
                                    {STATUS_FILTERS.map(f => {
                                        const count = datedAudits.filter(a => matchesStatus(a.s, f.value)).length;
                                        const active = status === f.value;
                                        return (
                                            <button
                                                key={f.value}
                                                onClick={() => setStatus(f.value)}
                                                className={`flex flex-col items-center justify-center rounded-lg px-1 py-1.5 leading-tight transition-colors ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                <span className="text-[11px] font-semibold text-center">{f.label}</span>
                                                <span className={`text-sm font-bold ${active ? 'text-white' : 'text-gray-900'}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-2 px-1">
                                <span className="text-xs text-gray-500">
                                    Menampilkan <b className="text-gray-700">{visibleAudits.length}</b> dari {audits.length} inspeksi
                                </span>
                                {hasFilter && (
                                    <button
                                        onClick={() => { setStartDate(''); setEndDate(''); setStatus('ALL'); }}
                                        className="text-xs font-semibold text-gray-500 hover:text-gray-900"
                                    >
                                        Reset filter
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 mt-2">
                            {visibleAudits.length === 0 && (
                                <div className="text-center py-10 bg-white border border-gray-200 border-dashed rounded-xl">
                                    <p className="text-gray-500 text-sm">Tidak ada inspeksi yang cocok dengan filter.</p>
                                </div>
                            )}
                            {visibleAudits.map(({ h, s: { checks, defects, ia, cap } }) => {
                                const hasPendingAction = ia.filled < ia.total || cap.filled < cap.total;

                                const defectRate = checks > 0 ? ((defects / checks) * 100).toFixed(2) : '0';

                                return (
                                    <div
                                        key={h.rqcHeaderId}
                                        onClick={() => router.push(inspectorSummaryUrl(h.rqcHeaderId, '?view=true'))}
                                        className={`border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cap.total > 0
                                            // CAP daily: a defect above 20% marks the whole card red
                                            ? 'bg-red-50 border-red-400 border-l-4 hover:border-red-500'
                                            : hasPendingAction ? 'bg-white border-amber-300 hover:border-amber-400' : 'bg-white border-gray-200 hover:border-gray-400'}`}
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 text-sm">
                                                    {formatDate(h.date)}
                                                    <span className="font-medium text-gray-400"> · {h.checkingTime}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {/* Factory / cell tell apart audits with the same date, time and PO */}
                                                    <span className="font-semibold text-gray-700">{h.factory?.factory || '-'} · {h.cell || '-'}</span>
                                                    <span className="font-mono"> · PO {h.po}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-base font-bold text-red-600 leading-tight">{defectRate}%</div>
                                                <div className="text-[11px] text-gray-400">Defect rate</div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end gap-3 mt-3">
                                            {/* Immediate Action / CAP follow-up status */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {/* Saved on this device, not on the server yet */}
                                                {h._pendingSync && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {h._localOnly ? 'Dibuat offline · belum terkirim' : 'Belum terkirim'}
                                                    </span>
                                                )}
                                                {ia.total === 0 && cap.total === 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                                        Tidak ada temuan defect
                                                    </span>
                                                ) : (
                                                    <>
                                                        <ActionBadge label="Immediate Action" filled={ia.filled} total={ia.total} />
                                                        <ActionBadge label="CAP" filled={cap.filled} total={cap.total} />
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex gap-1.5 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(inspectorSessionUrl(h.rqcHeaderId));
                                                        }}
                                                        className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100"
                                                        title="Edit"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm('Yakin ingin menghapus form inspeksi ini beserta seluruh data proses?')) {
                                                                const targetBtn = e.currentTarget as HTMLButtonElement | null;
                                                                if (targetBtn) targetBtn.disabled = true;
                                                                // An audit made offline is removed from this device; a server one needs the connection
                                                                deleteHeader(h.rqcHeaderId)
                                                                    .then(() => setHeaders(headers.filter((r: any) => r.rqcHeaderId !== h.rqcHeaderId)))
                                                                    .catch(err => {
                                                                        if (targetBtn) targetBtn.disabled = false;
                                                                        alert(err instanceof Error ? err.message : 'Failed to delete.');
                                                                    });
                                                            }
                                                        }}
                                                        className="p-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors border border-red-100"
                                                        title="Delete"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Floating Button for New Report */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t px-4 pt-4 pb-8 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-2xl mx-auto w-full">
                    <button
                        onClick={() => router.push(`/audit/${modelId}/header`)}
                        className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Report
                    </button>
                </div>
            </div>
        </div>
    );
}
