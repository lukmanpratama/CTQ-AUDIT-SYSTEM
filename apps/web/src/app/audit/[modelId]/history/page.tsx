'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';
import { modelLabel } from '../../../../lib/model-label';

const isFilled = (v?: string | null) => !!(v && v.trim() !== '');

function ActionBadge({ label, filled, total }: { label: string; filled: number; total: number }) {
    if (total === 0) return null;
    const done = filled >= total;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${done ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
            title={done ? `${label} sudah diisi semua` : `${total - filled} ${label} belum diisi`}
        >
            {done ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01" /></svg>
            )}
            {label}: {done ? 'Sudah diisi' : 'Belum diisi'} ({filled}/{total})
        </span>
    );
}

export default function RqcModelHistoryPage({ params }: { params: Promise<{ modelId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const modelId = resolvedParams.modelId;

    const [loading, setLoading] = useState(true);
    const [headers, setHeaders] = useState<any[]>([]);

    useEffect(() => {
        fetch(`/api/rqc/headers?modelId=${modelId}`)
            .then(res => res.json())
            .then(data => {
                setHeaders(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load headers', err);
                setLoading(false);
            });
    }, [modelId]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative">
            {/* Top Navigation Bar */}
            <nav className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                <button onClick={() => router.push('/dashboard')} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Dashboard
                </button>
            </nav>

            <div className="flex-1 p-5 overflow-y-auto max-w-2xl mx-auto w-full">
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
                        <div className="space-y-4 mt-2">
                            {headers.map(h => {
                                let checks = 0;
                                let defects = 0;
                                // Follow-up status: same rule as the dashboard
                                // (Immediate Action is filled when Action Plan has text, CAP when Root Cause has text)
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
                                                if (isFilled(i.rootCause)) cap.filled++;
                                            } else if (i.status === 'IMMEDIATE_ACTION' || i.status === 'IA') {
                                                ia.total++;
                                                if (isFilled(i.actionPlan)) ia.filled++;
                                            }
                                        });
                                    });
                                });
                                const hasPendingAction = ia.filled < ia.total || cap.filled < cap.total;

                                const defectRate = checks > 0 ? ((defects / checks) * 100).toFixed(2) : '0';

                                return (
                                    <div
                                        key={h.rqcHeaderId}
                                        onClick={() => router.push(`/audit/session/${h.rqcHeaderId}/summary?view=true`)}
                                        className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${hasPendingAction ? 'border-amber-300 hover:border-amber-400' : 'border-gray-200 hover:border-gray-400'}`}
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
                                                            router.push(`/audit/session/${h.rqcHeaderId}`);
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
                                                                fetch(`/api/rqc/headers/${h.rqcHeaderId}`, { method: 'DELETE' })
                                                                    .then(res => {
                                                                        if (res.ok) setHeaders(headers.filter((r: any) => r.rqcHeaderId !== h.rqcHeaderId));
                                                                        else alert('Failed to delete.');
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
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
